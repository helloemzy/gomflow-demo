import { 
  SubscriptionAnalytics, 
  ChurnPrediction, 
  SubscriptionPlan, 
  SubscriptionStatus,
  UserSubscription 
} from '@gomflow/shared';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// =============================================================================
// SUBSCRIPTION ANALYTICS SERVICE
// =============================================================================

export interface ChurnFactors {
  paymentFailures: number;
  supportTickets: number;
  featureUsageDecline: number;
  lastLoginDays: number;
  planDowngrades: number;
  trialConversionFailure: boolean;
  competitorSignals: number;
  usageLimitHits: number;
}

export interface RevenueMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  netRevenue: number;
  churnedRevenue: number;
  newRevenue: number;
  expansionRevenue: number; // From upgrades
  contractionRevenue: number; // From downgrades
  reactivatedRevenue: number;
}

export interface CohortAnalysis {
  cohortMonth: string;
  initialSubscribers: number;
  retentionRates: number[]; // Month 0, 1, 2, 3... retention rates
  revenueRetention: number[];
  churnedSubscribers: number[];
  averageRevenuePerUser: number[];
}

export class SubscriptionAnalyticsService {
  private supabase = createClientComponentClient();
  private churnModelWeights = {
    paymentFailures: 0.25,
    supportTickets: 0.15,
    featureUsageDecline: 0.20,
    lastLoginDays: 0.15,
    planDowngrades: 0.10,
    trialConversionFailure: 0.10,
    usageLimitHits: 0.05,
  };

  // =============================================================================
  // CORE ANALYTICS
  // =============================================================================

  async getSubscriptionAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<SubscriptionAnalytics> {
    try {
      const end = endDate || new Date();
      const start = startDate || new Date(end.getFullYear(), end.getMonth() - 12, 1);

      // Get subscription counts
      const { data: subscriptions } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const activeSubscriptions = subscriptions?.filter(sub => sub.status === 'active') || [];
      const trialUsers = subscriptions?.filter(sub => sub.status === 'trial') || [];
      const churned = subscriptions?.filter(sub => 
        ['cancelled', 'expired'].includes(sub.status)
      ) || [];

      // Calculate revenue metrics
      const revenueMetrics = await this.calculateRevenueMetrics(start, end);

      // Calculate churn rate
      const totalSubscriptions = subscriptions?.length || 0;
      const churnRate = totalSubscriptions > 0 ? (churned.length / totalSubscriptions) * 100 : 0;

      // Calculate trial conversion rate
      const convertedTrials = subscriptions?.filter(sub => 
        sub.trial_status === 'converted'
      )?.length || 0;
      const totalTrials = subscriptions?.filter(sub => 
        sub.trial_start_date
      )?.length || 0;
      const trialConversionRate = totalTrials > 0 ? (convertedTrials / totalTrials) * 100 : 0;

      // Revenue by plan
      const revenueByPlan = await this.calculateRevenueByPlan(activeSubscriptions);

      // Subscribers by plan
      const subscribersByPlan = this.calculateSubscribersByPlan(activeSubscriptions);

      // Calculate ARPU and CLV
      const averageRevenuePerUser = revenueMetrics.mrr / Math.max(1, activeSubscriptions.length);
      const customerLifetimeValue = await this.calculateCustomerLifetimeValue();

      return {
        total_subscribers: totalSubscriptions,
        active_subscribers: activeSubscriptions.length,
        trial_users: trialUsers.length,
        churned_users: churned.length,
        mrr: revenueMetrics.mrr,
        arr: revenueMetrics.arr,
        churn_rate: churnRate,
        trial_conversion_rate: trialConversionRate,
        revenue_by_plan: revenueByPlan,
        subscribers_by_plan: subscribersByPlan,
        average_revenue_per_user: averageRevenuePerUser,
        customer_lifetime_value: customerLifetimeValue,
      };

    } catch (error) {
      console.error('Subscription analytics calculation failed:', error);
      throw new Error('Failed to calculate subscription analytics');
    }
  }

  // =============================================================================
  // CHURN PREDICTION
  // =============================================================================

  async predictChurn(userId?: string): Promise<ChurnPrediction[]> {
    try {
      let userIds: string[];

      if (userId) {
        userIds = [userId];
      } else {
        // Get all active subscribers for batch prediction
        const { data: activeUsers } = await this.supabase
          .from('user_subscriptions')
          .select('user_id')
          .eq('status', 'active');
        
        userIds = activeUsers?.map(u => u.user_id) || [];
      }

      const predictions: ChurnPrediction[] = [];

      for (const uid of userIds) {
        const prediction = await this.calculateChurnPrediction(uid);
        if (prediction) {
          predictions.push(prediction);
        }
      }

      return predictions.sort((a, b) => b.churn_probability - a.churn_probability);

    } catch (error) {
      console.error('Churn prediction failed:', error);
      return [];
    }
  }

  private async calculateChurnPrediction(userId: string): Promise<ChurnPrediction | null> {
    try {
      // Gather churn factors
      const factors = await this.gatherChurnFactors(userId);
      
      // Calculate churn probability using weighted model
      const churnProbability = this.calculateChurnScore(factors);
      
      // Determine risk level
      const riskLevel = this.getRiskLevel(churnProbability);
      
      // Generate contributing factors and recommendations
      const contributingFactors = this.identifyContributingFactors(factors);
      const recommendedActions = this.generateChurnPreventionActions(factors, riskLevel);

      // Get engagement metrics
      const { data: lastActivity } = await this.supabase
        .from('feature_usage_logs')
        .select('timestamp')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      const engagementScore = await this.calculateEngagementScore(userId);

      return {
        user_id: userId,
        churn_probability: churnProbability,
        risk_level: riskLevel,
        contributing_factors: contributingFactors,
        recommended_actions: recommendedActions,
        last_activity_date: lastActivity?.timestamp ? new Date(lastActivity.timestamp) : undefined,
        engagement_score: engagementScore,
        support_tickets: factors.supportTickets,
        payment_failures: factors.paymentFailures,
        feature_usage_decline: factors.featureUsageDecline,
        created_at: new Date(),
      };

    } catch (error) {
      console.error(`Churn prediction failed for user ${userId}:`, error);
      return null;
    }
  }

  private async gatherChurnFactors(userId: string): Promise<ChurnFactors> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Payment failures in last 30 days
    const { data: paymentFailures } = await this.supabase
      .from('billing_invoices')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'uncollectible')
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Support tickets in last 30 days
    const { data: supportTickets } = await this.supabase
      .from('support_tickets')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Feature usage decline (compare last 30 days vs previous 30 days)
    const currentUsage = await this.getUsageMetrics(userId, thirtyDaysAgo, new Date());
    const previousUsage = await this.getUsageMetrics(userId, sixtyDaysAgo, thirtyDaysAgo);
    const featureUsageDecline = this.calculateUsageDecline(currentUsage, previousUsage);

    // Last login
    const { data: lastLogin } = await this.supabase
      .from('user_sessions')
      .select('last_login')
      .eq('user_id', userId)
      .order('last_login', { ascending: false })
      .limit(1)
      .single();

    const lastLoginDays = lastLogin?.last_login ? 
      Math.floor((Date.now() - new Date(lastLogin.last_login).getTime()) / (1000 * 60 * 60 * 24)) : 999;

    // Plan downgrades in last 90 days
    const { data: downgrades } = await this.supabase
      .from('subscription_events')
      .select('id')
      .eq('user_id', userId)
      .eq('event_type', 'downgraded')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    // Trial conversion failure
    const { data: trialData } = await this.supabase
      .from('user_subscriptions')
      .select('trial_status')
      .eq('user_id', userId)
      .not('trial_start_date', 'is', null)
      .single();

    const trialConversionFailure = trialData?.trial_status === 'expired';

    // Usage limit hits in last 30 days
    const { data: limitAlerts } = await this.supabase
      .from('usage_limit_alerts')
      .select('id')
      .eq('user_id', userId)
      .eq('alert_threshold', 100)
      .gte('created_at', thirtyDaysAgo.toISOString());

    return {
      paymentFailures: paymentFailures?.length || 0,
      supportTickets: supportTickets?.length || 0,
      featureUsageDecline,
      lastLoginDays,
      planDowngrades: downgrades?.length || 0,
      trialConversionFailure,
      competitorSignals: 0, // Would be populated from external data
      usageLimitHits: limitAlerts?.length || 0,
    };
  }

  private calculateChurnScore(factors: ChurnFactors): number {
    let score = 0;

    // Payment failures (0-25 points)
    score += Math.min(25, factors.paymentFailures * 12.5) * this.churnModelWeights.paymentFailures;

    // Support tickets (0-15 points)
    score += Math.min(15, factors.supportTickets * 5) * this.churnModelWeights.supportTickets;

    // Feature usage decline (0-20 points)
    score += Math.min(20, factors.featureUsageDecline) * this.churnModelWeights.featureUsageDecline;

    // Last login days (0-15 points)
    const loginScore = factors.lastLoginDays > 30 ? 15 : (factors.lastLoginDays / 30) * 15;
    score += loginScore * this.churnModelWeights.lastLoginDays;

    // Plan downgrades (0-10 points)
    score += Math.min(10, factors.planDowngrades * 5) * this.churnModelWeights.planDowngrades;

    // Trial conversion failure (0-10 points)
    score += (factors.trialConversionFailure ? 10 : 0) * this.churnModelWeights.trialConversionFailure;

    // Usage limit hits (0-5 points)
    score += Math.min(5, factors.usageLimitHits * 2.5) * this.churnModelWeights.usageLimitHits;

    return Math.min(100, Math.max(0, score));
  }

  private getRiskLevel(churnProbability: number): 'low' | 'medium' | 'high' | 'critical' {
    if (churnProbability >= 80) return 'critical';
    if (churnProbability >= 60) return 'high';
    if (churnProbability >= 40) return 'medium';
    return 'low';
  }

  private identifyContributingFactors(factors: ChurnFactors): string[] {
    const contributing: string[] = [];

    if (factors.paymentFailures > 0) {
      contributing.push(`${factors.paymentFailures} payment failure(s) in last 30 days`);
    }
    if (factors.supportTickets > 2) {
      contributing.push(`High support ticket volume (${factors.supportTickets})`);
    }
    if (factors.featureUsageDecline > 30) {
      contributing.push(`Significant usage decline (${factors.featureUsageDecline.toFixed(1)}%)`);
    }
    if (factors.lastLoginDays > 14) {
      contributing.push(`Inactive for ${factors.lastLoginDays} days`);
    }
    if (factors.planDowngrades > 0) {
      contributing.push('Recent plan downgrade');
    }
    if (factors.trialConversionFailure) {
      contributing.push('Failed to convert from trial');
    }
    if (factors.usageLimitHits > 1) {
      contributing.push('Frequently hitting usage limits');
    }

    return contributing;
  }

  private generateChurnPreventionActions(
    factors: ChurnFactors,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): string[] {
    const actions: string[] = [];

    if (riskLevel === 'critical') {
      actions.push('Immediate personal outreach from success team');
      actions.push('Offer retention discount or plan modification');
    }

    if (factors.paymentFailures > 0) {
      actions.push('Update payment method and resolve billing issues');
      actions.push('Offer payment plan or billing pause');
    }

    if (factors.supportTickets > 2) {
      actions.push('Priority support queue assignment');
      actions.push('Schedule success call to address concerns');
    }

    if (factors.featureUsageDecline > 30) {
      actions.push('Send re-engagement email campaign');
      actions.push('Offer training session or product walkthrough');
    }

    if (factors.lastLoginDays > 14) {
      actions.push('Send winback email sequence');
      actions.push('Highlight new features and improvements');
    }

    if (factors.usageLimitHits > 1) {
      actions.push('Discuss plan upgrade options');
      actions.push('Provide usage optimization consultation');
    }

    // General actions based on risk level
    if (riskLevel === 'high') {
      actions.push('Send satisfaction survey');
      actions.push('Assign dedicated success manager');
    } else if (riskLevel === 'medium') {
      actions.push('Include in proactive outreach campaign');
      actions.push('Send educational content about value');
    }

    return actions;
  }

  // =============================================================================
  // REVENUE ANALYTICS
  // =============================================================================

  private async calculateRevenueMetrics(startDate: Date, endDate: Date): Promise<RevenueMetrics> {
    // Get all invoices in the period
    const { data: invoices } = await this.supabase
      .from('billing_invoices')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const paidInvoices = invoices?.filter(inv => inv.status === 'paid') || [];
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    // Calculate MRR (Monthly Recurring Revenue)
    const { data: activeSubscriptions } = await this.supabase
      .from('user_subscriptions')
      .select('amount, billing_cycle')
      .eq('status', 'active');

    let mrr = 0;
    activeSubscriptions?.forEach(sub => {
      if (sub.billing_cycle === 'monthly') {
        mrr += sub.amount;
      } else if (sub.billing_cycle === 'yearly') {
        mrr += sub.amount / 12;
      }
    });

    const arr = mrr * 12;

    // Get churned revenue (approximate)
    const { data: churned } = await this.supabase
      .from('user_subscriptions')
      .select('amount, billing_cycle, cancelled_at')
      .in('status', ['cancelled', 'expired'])
      .gte('cancelled_at', startDate.toISOString())
      .lte('cancelled_at', endDate.toISOString());

    const churnedRevenue = churned?.reduce((sum, sub) => {
      const monthlyAmount = sub.billing_cycle === 'yearly' ? sub.amount / 12 : sub.amount;
      return sum + monthlyAmount;
    }, 0) || 0;

    // Get new revenue from subscriptions created in period
    const { data: newSubscriptions } = await this.supabase
      .from('user_subscriptions')
      .select('amount, billing_cycle')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .neq('status', 'trial');

    const newRevenue = newSubscriptions?.reduce((sum, sub) => {
      const monthlyAmount = sub.billing_cycle === 'yearly' ? sub.amount / 12 : sub.amount;
      return sum + monthlyAmount;
    }, 0) || 0;

    // Get expansion revenue from upgrades
    const { data: upgrades } = await this.supabase
      .from('subscription_events')
      .select('metadata')
      .eq('event_type', 'upgraded')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const expansionRevenue = upgrades?.reduce((sum, event) => {
      const revenueIncrease = event.metadata?.revenue_increase || 0;
      return sum + revenueIncrease;
    }, 0) || 0;

    return {
      mrr,
      arr,
      netRevenue: totalRevenue - churnedRevenue,
      churnedRevenue,
      newRevenue,
      expansionRevenue,
      contractionRevenue: 0, // Would calculate from downgrades
      reactivatedRevenue: 0, // Would calculate from reactivations
    };
  }

  private async calculateRevenueByPlan(subscriptions: UserSubscription[]): Promise<Record<SubscriptionPlan, number>> {
    const revenueByPlan: Record<SubscriptionPlan, number> = {
      freemium: 0,
      starter: 0,
      professional: 0,
      enterprise: 0,
    };

    subscriptions.forEach(sub => {
      const monthlyRevenue = sub.billing_cycle === 'yearly' ? sub.amount / 12 : sub.amount;
      revenueByPlan[sub.plan] += monthlyRevenue;
    });

    return revenueByPlan;
  }

  private calculateSubscribersByPlan(subscriptions: UserSubscription[]): Record<SubscriptionPlan, number> {
    const subscribersByPlan: Record<SubscriptionPlan, number> = {
      freemium: 0,
      starter: 0,
      professional: 0,
      enterprise: 0,
    };

    subscriptions.forEach(sub => {
      subscribersByPlan[sub.plan]++;
    });

    return subscribersByPlan;
  }

  // =============================================================================
  // COHORT ANALYSIS
  // =============================================================================

  async getCohortAnalysis(months: number = 12): Promise<CohortAnalysis[]> {
    const cohorts: CohortAnalysis[] = [];
    const endDate = new Date();

    for (let i = 0; i < months; i++) {
      const cohortDate = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
      const nextMonth = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + 1, 1);

      // Get initial subscribers for this cohort
      const { data: cohortSubscribers } = await this.supabase
        .from('user_subscriptions')
        .select('user_id, created_at, amount, billing_cycle')
        .gte('created_at', cohortDate.toISOString())
        .lt('created_at', nextMonth.toISOString())
        .neq('status', 'trial');

      if (!cohortSubscribers || cohortSubscribers.length === 0) continue;

      const initialSubscribers = cohortSubscribers.length;
      const retentionRates: number[] = [];
      const revenueRetention: number[] = [];
      const churnedSubscribers: number[] = [];
      const averageRevenuePerUser: number[] = [];

      // Calculate retention for each month since cohort start
      const monthsToAnalyze = Math.min(12, Math.floor((endDate.getTime() - cohortDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));

      for (let monthOffset = 0; monthOffset <= monthsToAnalyze; monthOffset++) {
        const analysisDate = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + monthOffset, 1);
        
        // Get active subscribers from this cohort at analysis date
        const { data: activeInMonth } = await this.supabase
          .from('user_subscriptions')
          .select('user_id, amount, billing_cycle')
          .in('user_id', cohortSubscribers.map(s => s.user_id))
          .eq('status', 'active')
          .lte('created_at', analysisDate.toISOString());

        const activeCount = activeInMonth?.length || 0;
        const retentionRate = (activeCount / initialSubscribers) * 100;
        retentionRates.push(retentionRate);

        // Calculate revenue retention
        const monthlyRevenue = activeInMonth?.reduce((sum, sub) => {
          const monthlyAmount = sub.billing_cycle === 'yearly' ? sub.amount / 12 : sub.amount;
          return sum + monthlyAmount;
        }, 0) || 0;

        const initialRevenue = cohortSubscribers.reduce((sum, sub) => {
          const monthlyAmount = sub.billing_cycle === 'yearly' ? sub.amount / 12 : sub.amount;
          return sum + monthlyAmount;
        }, 0);

        const revenueRetentionRate = initialRevenue > 0 ? (monthlyRevenue / initialRevenue) * 100 : 0;
        revenueRetention.push(revenueRetentionRate);

        // Calculate churned subscribers
        const churnedCount = initialSubscribers - activeCount;
        churnedSubscribers.push(churnedCount);

        // Calculate ARPU
        const arpu = activeCount > 0 ? monthlyRevenue / activeCount : 0;
        averageRevenuePerUser.push(arpu);
      }

      cohorts.push({
        cohortMonth: cohortDate.toISOString().substring(0, 7), // YYYY-MM format
        initialSubscribers,
        retentionRates,
        revenueRetention,
        churnedSubscribers,
        averageRevenuePerUser,
      });
    }

    return cohorts.reverse(); // Most recent cohorts first
  }

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  private async getUsageMetrics(userId: string, startDate: Date, endDate: Date): Promise<any> {
    const { data: usage } = await this.supabase
      .from('usage_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('period_start', startDate.toISOString())
      .lte('period_end', endDate.toISOString());

    return usage?.[0] || {};
  }

  private calculateUsageDecline(current: any, previous: any): number {
    if (!current || !previous) return 0;

    const metrics = ['orders_created', 'submissions_received', 'api_calls_made'];
    let totalDecline = 0;
    let validMetrics = 0;

    for (const metric of metrics) {
      const currentValue = current[metric] || 0;
      const previousValue = previous[metric] || 0;

      if (previousValue > 0) {
        const decline = ((previousValue - currentValue) / previousValue) * 100;
        totalDecline += Math.max(0, decline); // Only count declines, not increases
        validMetrics++;
      }
    }

    return validMetrics > 0 ? totalDecline / validMetrics : 0;
  }

  private async calculateEngagementScore(userId: string): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get recent activity
    const { data: activities } = await this.supabase
      .from('feature_usage_logs')
      .select('feature_name, timestamp')
      .eq('user_id', userId)
      .gte('timestamp', thirtyDaysAgo.toISOString());

    if (!activities || activities.length === 0) return 0;

    // Calculate engagement factors
    const uniqueDays = new Set(activities.map(a => a.timestamp.substring(0, 10))).size;
    const uniqueFeatures = new Set(activities.map(a => a.feature_name)).size;
    const totalActivities = activities.length;

    // Engagement score (0-100)
    const dayScore = (uniqueDays / 30) * 40; // Max 40 points for daily activity
    const featureScore = Math.min(uniqueFeatures * 5, 30); // Max 30 points for feature diversity
    const volumeScore = Math.min(totalActivities / 10, 30); // Max 30 points for activity volume

    return Math.round(dayScore + featureScore + volumeScore);
  }

  private async calculateCustomerLifetimeValue(): Promise<number> {
    // Simplified CLV calculation
    // CLV = (Average Revenue Per User) × (Customer Lifespan in months)
    
    const { data: subscriptions } = await this.supabase
      .from('user_subscriptions')
      .select('amount, billing_cycle, created_at, cancelled_at')
      .eq('status', 'active');

    if (!subscriptions || subscriptions.length === 0) return 0;

    // Calculate average monthly revenue
    const totalMonthlyRevenue = subscriptions.reduce((sum, sub) => {
      const monthlyAmount = sub.billing_cycle === 'yearly' ? sub.amount / 12 : sub.amount;
      return sum + monthlyAmount;
    }, 0);

    const arpu = totalMonthlyRevenue / subscriptions.length;

    // Calculate average customer lifespan (simplified)
    const averageLifespanMonths = 24; // Would be calculated from historical data

    return arpu * averageLifespanMonths;
  }

  // =============================================================================
  // REPORTING METHODS
  // =============================================================================

  async generateSubscriptionReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    analytics: SubscriptionAnalytics;
    churnPredictions: ChurnPrediction[];
    cohortAnalysis: CohortAnalysis[];
    revenueMetrics: RevenueMetrics;
    summary: {
      healthScore: number;
      keyInsights: string[];
      recommendations: string[];
    };
  }> {
    const [analytics, churnPredictions, cohortAnalysis] = await Promise.all([
      this.getSubscriptionAnalytics(startDate, endDate),
      this.predictChurn(),
      this.getCohortAnalysis(6), // Last 6 months
    ]);

    const revenueMetrics = await this.calculateRevenueMetrics(startDate, endDate);

    // Calculate overall health score
    const healthScore = this.calculateHealthScore(analytics, churnPredictions);

    // Generate insights and recommendations
    const keyInsights = this.generateKeyInsights(analytics, churnPredictions, revenueMetrics);
    const recommendations = this.generateRecommendations(analytics, churnPredictions, revenueMetrics);

    return {
      analytics,
      churnPredictions: churnPredictions.slice(0, 20), // Top 20 at-risk users
      cohortAnalysis,
      revenueMetrics,
      summary: {
        healthScore,
        keyInsights,
        recommendations,
      },
    };
  }

  private calculateHealthScore(
    analytics: SubscriptionAnalytics,
    churnPredictions: ChurnPrediction[]
  ): number {
    let score = 100;

    // Churn rate impact (max -30 points)
    if (analytics.churn_rate > 10) score -= 30;
    else if (analytics.churn_rate > 5) score -= 15;
    else if (analytics.churn_rate > 2) score -= 5;

    // Trial conversion impact (max -20 points)
    if (analytics.trial_conversion_rate < 10) score -= 20;
    else if (analytics.trial_conversion_rate < 20) score -= 10;
    else if (analytics.trial_conversion_rate < 30) score -= 5;

    // High-risk users impact (max -25 points)
    const highRiskUsers = churnPredictions.filter(p => 
      ['high', 'critical'].includes(p.risk_level)
    ).length;
    const riskPercentage = (highRiskUsers / Math.max(1, analytics.active_subscribers)) * 100;
    
    if (riskPercentage > 20) score -= 25;
    else if (riskPercentage > 10) score -= 15;
    else if (riskPercentage > 5) score -= 8;

    // Growth trend impact (max -25 points)
    const growth = analytics.active_subscribers / Math.max(1, analytics.total_subscribers);
    if (growth < 0.5) score -= 25;
    else if (growth < 0.7) score -= 15;
    else if (growth < 0.8) score -= 8;

    return Math.max(0, Math.min(100, score));
  }

  private generateKeyInsights(
    analytics: SubscriptionAnalytics,
    churnPredictions: ChurnPrediction[],
    revenueMetrics: RevenueMetrics
  ): string[] {
    const insights: string[] = [];

    // Churn insights
    const criticalRisk = churnPredictions.filter(p => p.risk_level === 'critical').length;
    if (criticalRisk > 0) {
      insights.push(`${criticalRisk} subscribers at critical churn risk need immediate attention`);
    }

    // Revenue insights
    if (revenueMetrics.expansionRevenue > revenueMetrics.newRevenue) {
      insights.push('Expansion revenue exceeds new customer revenue - strong upselling success');
    }

    // Conversion insights
    if (analytics.trial_conversion_rate > 25) {
      insights.push('Strong trial conversion rate indicates good product-market fit');
    } else if (analytics.trial_conversion_rate < 15) {
      insights.push('Low trial conversion rate suggests onboarding or value demonstration issues');
    }

    // Plan distribution insights
    const professionalUsers = analytics.subscribers_by_plan.professional;
    const totalPaid = analytics.active_subscribers - analytics.subscribers_by_plan.freemium;
    if (totalPaid > 0 && (professionalUsers / totalPaid) > 0.4) {
      insights.push('High proportion of professional plan users indicates strong value perception');
    }

    return insights;
  }

  private generateRecommendations(
    analytics: SubscriptionAnalytics,
    churnPredictions: ChurnPrediction[],
    revenueMetrics: RevenueMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Churn prevention recommendations
    if (analytics.churn_rate > 5) {
      recommendations.push('Implement proactive churn prevention campaign for at-risk users');
      recommendations.push('Analyze exit feedback to identify common cancellation reasons');
    }

    // Conversion optimization recommendations
    if (analytics.trial_conversion_rate < 20) {
      recommendations.push('Optimize trial onboarding flow to demonstrate value earlier');
      recommendations.push('Implement trial extension program for engaged but non-converting users');
    }

    // Revenue optimization recommendations
    if (revenueMetrics.expansionRevenue < revenueMetrics.newRevenue * 0.3) {
      recommendations.push('Focus on upselling existing customers to higher-tier plans');
      recommendations.push('Develop usage-based upgrade triggers');
    }

    // High-risk user recommendations
    const highRiskCount = churnPredictions.filter(p => 
      ['high', 'critical'].includes(p.risk_level)
    ).length;
    
    if (highRiskCount > analytics.active_subscribers * 0.1) {
      recommendations.push('Assign dedicated success managers to high-risk accounts');
      recommendations.push('Implement win-back offers for users showing early churn signals');
    }

    return recommendations;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const subscriptionAnalytics = new SubscriptionAnalyticsService();