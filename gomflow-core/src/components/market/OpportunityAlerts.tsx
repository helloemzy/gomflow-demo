'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { MarketOpportunity } from '../../lib/market/marketAnalytics';
import { formatMarketValue, formatPercentageChange } from '../../lib/market/marketAnalytics';
import { 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Target,
  Lightbulb,
  MapPin,
  Zap,
  Star,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  Bell,
  Archive
} from 'lucide-react';

interface OpportunityAlertsProps {
  opportunities: MarketOpportunity[];
  className?: string;
}

export const OpportunityAlerts: React.FC<OpportunityAlertsProps> = ({ 
  opportunities, 
  className 
}) => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'opportunity_score' | 'revenue_potential' | 'created_at'>('opportunity_score');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const opportunityTypes = ['all', 'product_gap', 'price_gap', 'geographic_gap', 'timing_gap'];
  const difficulties = ['all', 'low', 'medium', 'high'];

  const filteredOpportunities = opportunities.filter(opp => {
    const matchesType = selectedType === 'all' || opp.type === selectedType;
    const matchesDifficulty = selectedDifficulty === 'all' || opp.difficulty === selectedDifficulty;
    const matchesSearch = opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opp.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesType && matchesDifficulty && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'created_at') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return b[sortBy] - a[sortBy];
  });

  const getOpportunityIcon = (type: string) => {
    switch (type) {
      case 'product_gap':
        return <Target className="w-5 h-5 text-blue-500" />;
      case 'price_gap':
        return <DollarSign className="w-5 h-5 text-green-500" />;
      case 'geographic_gap':
        return <MapPin className="w-5 h-5 text-purple-500" />;
      case 'timing_gap':
        return <Clock className="w-5 h-5 text-orange-500" />;
      default:
        return <Lightbulb className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getOpportunityColor = (type: string) => {
    switch (type) {
      case 'product_gap':
        return 'border-blue-200 bg-blue-50';
      case 'price_gap':
        return 'border-green-200 bg-green-50';
      case 'geographic_gap':
        return 'border-purple-200 bg-purple-50';
      case 'timing_gap':
        return 'border-orange-200 bg-orange-50';
      default:
        return 'border-yellow-200 bg-yellow-50';
    }
  };

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'low':
        return <Badge variant="secondary">Easy</Badge>;
      case 'medium':
        return <Badge variant="outline">Medium</Badge>;
      case 'high':
        return <Badge variant="destructive">Hard</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge variant="secondary">High Impact</Badge>;
    if (score >= 60) return <Badge variant="outline">Medium Impact</Badge>;
    return <Badge variant="destructive">Low Impact</Badge>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTimeDifference = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays} days ago`;
    if (diffHours > 0) return `${diffHours} hours ago`;
    return 'Just now';
  };

  const renderOpportunityCard = (opportunity: MarketOpportunity) => (
    <Card 
      key={opportunity.id} 
      className={`p-4 border-2 transition-all hover:shadow-md ${getOpportunityColor(opportunity.type)}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
            {getOpportunityIcon(opportunity.type)}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{opportunity.title}</h3>
            <p className="text-sm text-muted-foreground capitalize">
              {opportunity.type.replace('_', ' ')}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getScoreBadge(opportunity.opportunity_score)}
          {getDifficultyBadge(opportunity.difficulty)}
        </div>
      </div>

      <p className="text-sm text-gray-700 mb-4">{opportunity.description}</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-muted-foreground">Opportunity Score</p>
          <div className="flex items-center space-x-2">
            <Progress value={opportunity.opportunity_score} className="flex-1" />
            <span className={`text-sm font-medium ${getScoreColor(opportunity.opportunity_score)}`}>
              {opportunity.opportunity_score.toFixed(0)}
            </span>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Revenue Potential</p>
          <p className="text-lg font-bold">{formatMarketValue(opportunity.revenue_potential)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
        <div className="flex items-center space-x-1">
          <Clock className="w-4 h-4" />
          <span>{opportunity.timeframe}</span>
        </div>
        <div className="flex items-center space-x-1">
          <Bell className="w-4 h-4" />
          <span>{getTimeDifference(opportunity.created_at)}</span>
        </div>
      </div>

      {opportunity.actions && opportunity.actions.length > 0 && (
        <div className="pt-3 border-t">
          <p className="text-sm font-medium mb-2">Recommended Actions:</p>
          <div className="space-y-1">
            {opportunity.actions.slice(0, 3).map((action, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                <span>{action}</span>
              </div>
            ))}
            {opportunity.actions.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{opportunity.actions.length - 3} more actions
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );

  const renderOpportunityList = (opportunity: MarketOpportunity) => (
    <Card key={opportunity.id} className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
            {getOpportunityIcon(opportunity.type)}
          </div>
          <div>
            <h3 className="font-semibold">{opportunity.title}</h3>
            <p className="text-sm text-muted-foreground">{opportunity.description}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Score</p>
            <p className={`font-bold ${getScoreColor(opportunity.opportunity_score)}`}>
              {opportunity.opportunity_score.toFixed(0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Revenue</p>
            <p className="font-bold">{formatMarketValue(opportunity.revenue_potential)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Difficulty</p>
            <div>{getDifficultyBadge(opportunity.difficulty)}</div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Timeframe</p>
            <p className="text-sm">{opportunity.timeframe}</p>
          </div>
        </div>
      </div>
    </Card>
  );

  const getOpportunityStats = () => {
    const highImpact = opportunities.filter(o => o.opportunity_score >= 80).length;
    const totalRevenue = opportunities.reduce((sum, o) => sum + o.revenue_potential, 0);
    const easyOpportunities = opportunities.filter(o => o.difficulty === 'low').length;
    const recentOpportunities = opportunities.filter(o => {
      const daysSinceCreated = (new Date().getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreated <= 7;
    }).length;

    return { highImpact, totalRevenue, easyOpportunities, recentOpportunities };
  };

  const stats = getOpportunityStats();

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Market Opportunities</h2>
          <p className="text-muted-foreground">
            AI-identified opportunities for growth and expansion
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Bell className="w-4 h-4 mr-2" />
            Set Alerts
          </Button>
          <div className="flex items-center space-x-2 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded text-sm ${
                viewMode === 'grid' ? 'bg-background shadow-sm' : ''
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded text-sm ${
                viewMode === 'list' ? 'bg-background shadow-sm' : ''
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">High Impact</p>
              <p className="text-2xl font-bold">{stats.highImpact}</p>
            </div>
            <Star className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">{formatMarketValue(stats.totalRevenue)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Easy Wins</p>
              <p className="text-2xl font-bold">{stats.easyOpportunities}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">New This Week</p>
              <p className="text-2xl font-bold">{stats.recentOpportunities}</p>
            </div>
            <Zap className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search opportunities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {opportunityTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type.replace('_', ' ')}
              </option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {difficulties.map(difficulty => (
              <option key={difficulty} value={difficulty}>
                {difficulty === 'all' ? 'All Difficulties' : difficulty}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="opportunity_score">Score</option>
            <option value="revenue_potential">Revenue</option>
            <option value="created_at">Date</option>
          </select>
        </div>
      </div>

      {/* Opportunities */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {filteredOpportunities.length} Opportunities Found
          </h3>
          <Badge variant="secondary">
            {filteredOpportunities.filter(o => o.opportunity_score >= 80).length} high priority
          </Badge>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOpportunities.map(opportunity => renderOpportunityCard(opportunity))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOpportunities.map(opportunity => renderOpportunityList(opportunity))}
          </div>
        )}

        {filteredOpportunities.length === 0 && (
          <Card className="p-8 text-center">
            <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No opportunities found</p>
            <p className="text-muted-foreground">
              Try adjusting your filters or check back later for new opportunities
            </p>
          </Card>
        )}
      </div>

      {/* Opportunity Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Opportunity Insights</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Quick Wins</h4>
            <div className="space-y-2">
              {opportunities
                .filter(o => o.difficulty === 'low' && o.opportunity_score >= 60)
                .slice(0, 3)
                .map((opportunity, index) => (
                  <div key={index} className="flex items-center space-x-2 p-2 bg-green-50 rounded">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{opportunity.title}</span>
                    <Badge variant="outline" className="ml-auto">
                      {opportunity.opportunity_score.toFixed(0)}
                    </Badge>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">High Revenue Potential</h4>
            <div className="space-y-2">
              {opportunities
                .sort((a, b) => b.revenue_potential - a.revenue_potential)
                .slice(0, 3)
                .map((opportunity, index) => (
                  <div key={index} className="flex items-center space-x-2 p-2 bg-blue-50 rounded">
                    <DollarSign className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">{opportunity.title}</span>
                    <Badge variant="outline" className="ml-auto">
                      {formatMarketValue(opportunity.revenue_potential)}
                    </Badge>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};