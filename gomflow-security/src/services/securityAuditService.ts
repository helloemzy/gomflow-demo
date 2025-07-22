import { createClient } from '@supabase/supabase-js';
import { createAdapter } from '@redis/client';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import cron from 'node-cron';

import config from '../config';
import logger from '../utils/logger';
import {
  SecurityAuditResult,
  VulnerabilityReport,
  SecurityMetrics,
  ComplianceReport,
  SecurityIncident,
  SecurityScan,
  SecurityPolicy,
  SecurityAuditServiceInterface
} from '../types';

const execAsync = promisify(exec);

export class SecurityAuditService implements SecurityAuditServiceInterface {
  private supabase: any;
  private redis: any;
  private auditQueue: Queue;
  private initialized = false;
  private cronJobs: cron.ScheduledTask[] = [];

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize Supabase client
      this.supabase = createClient(
        config.SUPABASE_URL,
        config.SUPABASE_SERVICE_ROLE_KEY
      );

      // Initialize Redis client
      if (config.REDIS_URL) {
        this.redis = createAdapter({ url: config.REDIS_URL });
      } else {
        this.redis = createAdapter({
          socket: {
            host: config.REDIS_HOST,
            port: config.REDIS_PORT
          },
          password: config.REDIS_PASSWORD
        });
      }

      await this.redis.connect();

      // Initialize audit queue
      this.auditQueue = new Queue('security-audit', {
        redis: {
          host: config.REDIS_HOST,
          port: config.REDIS_PORT,
          password: config.REDIS_PASSWORD
        }
      });

      // Setup queue processors
      this.setupQueueProcessors();

      // Setup cron jobs
      this.setupCronJobs();

      this.initialized = true;
      logger.info('Security audit service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize security audit service:', error);
      throw error;
    }
  }

  private setupQueueProcessors(): void {
    // Process security scans
    this.auditQueue.process('security-scan', async (job) => {
      const { scanType, target } = job.data;
      await this.performSecurityScan(scanType, target);
    });

    // Process vulnerability assessments
    this.auditQueue.process('vulnerability-assessment', async (job) => {
      const { target } = job.data;
      await this.performVulnerabilityAssessment(target);
    });

    // Process compliance checks
    this.auditQueue.process('compliance-check', async (job) => {
      const { framework } = job.data;
      await this.performComplianceCheck(framework);
    });
  }

  private setupCronJobs(): void {
    // Daily security scan
    const dailyScan = cron.schedule('0 2 * * *', async () => {
      await this.scheduleDailySecurityScan();
    });

    // Weekly vulnerability assessment
    const weeklyVulnScan = cron.schedule('0 3 * * 0', async () => {
      await this.scheduleWeeklyVulnerabilityAssessment();
    });

    // Monthly compliance check
    const monthlyCompliance = cron.schedule('0 4 1 * *', async () => {
      await this.scheduleMonthlyComplianceCheck();
    });

    this.cronJobs = [dailyScan, weeklyVulnScan, monthlyCompliance];
    logger.info('Security audit cron jobs scheduled');
  }

  public async performSecurityAudit(): Promise<SecurityAuditResult> {
    try {
      const auditId = uuidv4();
      const startTime = new Date();

      logger.info('Starting comprehensive security audit', { auditId });

      // Perform multiple security checks in parallel
      const [dependencyAudit, codeAudit, configAudit, authAudit, dataAudit] = await Promise.all([
        this.auditDependencies(),
        this.auditCodeSecurity(),
        this.auditConfiguration(),
        this.auditAuthentication(),
        this.auditDataSecurity()
      ]);

      // Compile audit results
      const auditResult: SecurityAuditResult = {
        id: auditId,
        timestamp: startTime,
        duration: Date.now() - startTime.getTime(),
        overallScore: this.calculateOverallScore([
          dependencyAudit,
          codeAudit,
          configAudit,
          authAudit,
          dataAudit
        ]),
        categories: {
          dependencies: dependencyAudit,
          code: codeAudit,
          configuration: configAudit,
          authentication: authAudit,
          data: dataAudit
        },
        vulnerabilities: [],
        recommendations: [],
        compliance: await this.getComplianceStatus()
      };

      // Store audit result
      await this.storeAuditResult(auditResult);

      // Generate security metrics
      await this.updateSecurityMetrics(auditResult);

      logger.info('Security audit completed', {
        auditId,
        overallScore: auditResult.overallScore,
        duration: auditResult.duration
      });

      return auditResult;
    } catch (error) {
      logger.error('Failed to perform security audit:', error);
      throw error;
    }
  }

  public async scanForVulnerabilities(target: string): Promise<VulnerabilityReport> {
    try {
      const scanId = uuidv4();
      const startTime = new Date();

      logger.info('Starting vulnerability scan', { scanId, target });

      const vulnerabilities = await Promise.all([
        this.scanSQLInjection(target),
        this.scanXSS(target),
        this.scanCSRF(target),
        this.scanAuthenticationFlaws(target),
        this.scanInputValidation(target),
        this.scanEncryptionIssues(target)
      ]);

      const allVulnerabilities = vulnerabilities.flat();
      
      const report: VulnerabilityReport = {
        id: scanId,
        target,
        timestamp: startTime,
        duration: Date.now() - startTime.getTime(),
        vulnerabilities: allVulnerabilities,
        summary: {
          total: allVulnerabilities.length,
          critical: allVulnerabilities.filter(v => v.severity === 'critical').length,
          high: allVulnerabilities.filter(v => v.severity === 'high').length,
          medium: allVulnerabilities.filter(v => v.severity === 'medium').length,
          low: allVulnerabilities.filter(v => v.severity === 'low').length
        },
        recommendations: this.generateVulnerabilityRecommendations(allVulnerabilities)
      };

      // Store vulnerability report
      await this.storeVulnerabilityReport(report);

      logger.info('Vulnerability scan completed', {
        scanId,
        target,
        vulnerabilitiesFound: allVulnerabilities.length
      });

      return report;
    } catch (error) {
      logger.error('Failed to scan for vulnerabilities:', error);
      throw error;
    }
  }

  public async generateComplianceReport(framework: string): Promise<ComplianceReport> {
    try {
      const reportId = uuidv4();
      const startTime = new Date();

      logger.info('Generating compliance report', { reportId, framework });

      let checks = [];
      let overallScore = 0;

      switch (framework.toLowerCase()) {
        case 'gdpr':
          checks = await this.performGDPRChecks();
          break;
        case 'pci-dss':
          checks = await this.performPCIDSSChecks();
          break;
        case 'iso27001':
          checks = await this.performISO27001Checks();
          break;
        case 'owasp':
          checks = await this.performOWASPChecks();
          break;
        default:
          throw new Error(`Unsupported compliance framework: ${framework}`);
      }

      const passedChecks = checks.filter(c => c.status === 'passed').length;
      overallScore = (passedChecks / checks.length) * 100;

      const report: ComplianceReport = {
        id: reportId,
        framework,
        timestamp: startTime,
        duration: Date.now() - startTime.getTime(),
        overallScore,
        checks,
        summary: {
          totalChecks: checks.length,
          passed: passedChecks,
          failed: checks.filter(c => c.status === 'failed').length,
          warning: checks.filter(c => c.status === 'warning').length,
          notApplicable: checks.filter(c => c.status === 'not_applicable').length
        },
        recommendations: this.generateComplianceRecommendations(checks)
      };

      // Store compliance report
      await this.storeComplianceReport(report);

      logger.info('Compliance report generated', {
        reportId,
        framework,
        overallScore
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  // Private audit methods
  private async auditDependencies(): Promise<any> {
    try {
      logger.debug('Auditing dependencies');
      
      // Run npm audit
      const { stdout, stderr } = await execAsync('npm audit --json', {
        cwd: process.cwd()
      });

      if (stderr && !stderr.includes('npm WARN')) {
        logger.warn('npm audit warnings:', stderr);
      }

      const auditData = JSON.parse(stdout);
      
      const vulnerabilities = auditData.vulnerabilities || {};
      const vulnerabilityCount = Object.keys(vulnerabilities).length;
      
      const score = vulnerabilityCount === 0 ? 100 : 
                   vulnerabilityCount < 5 ? 80 : 
                   vulnerabilityCount < 10 ? 60 : 40;

      return {
        category: 'dependencies',
        score,
        issues: vulnerabilityCount,
        details: {
          vulnerabilities: vulnerabilityCount,
          critical: Object.values(vulnerabilities).filter((v: any) => v.severity === 'critical').length,
          high: Object.values(vulnerabilities).filter((v: any) => v.severity === 'high').length,
          moderate: Object.values(vulnerabilities).filter((v: any) => v.severity === 'moderate').length,
          low: Object.values(vulnerabilities).filter((v: any) => v.severity === 'low').length
        }
      };
    } catch (error) {
      logger.error('Failed to audit dependencies:', error);
      return {
        category: 'dependencies',
        score: 0,
        issues: 999,
        details: { error: error.message }
      };
    }
  }

  private async auditCodeSecurity(): Promise<any> {
    try {
      logger.debug('Auditing code security');
      
      const issues = [];
      
      // Check for common security anti-patterns
      const securityPatterns = [
        { pattern: /eval\(/, message: 'Dangerous eval() usage found', severity: 'high' },
        { pattern: /innerHTML\s*=/, message: 'Potential XSS via innerHTML', severity: 'medium' },
        { pattern: /document\.write\(/, message: 'Dangerous document.write() usage', severity: 'medium' },
        { pattern: /Math\.random\(\)/, message: 'Weak random number generation', severity: 'low' },
        { pattern: /password.*=.*['"].*['"]/, message: 'Hardcoded password detected', severity: 'critical' },
        { pattern: /api[_-]?key.*=.*['"].*['"]/, message: 'Hardcoded API key detected', severity: 'critical' }
      ];

      // This is a simplified implementation - in production, use proper SAST tools
      const score = issues.length === 0 ? 100 : 
                   issues.length < 3 ? 80 : 
                   issues.length < 6 ? 60 : 40;

      return {
        category: 'code',
        score,
        issues: issues.length,
        details: {
          securityIssues: issues.length,
          patterns: securityPatterns.length
        }
      };
    } catch (error) {
      logger.error('Failed to audit code security:', error);
      return {
        category: 'code',
        score: 0,
        issues: 999,
        details: { error: error.message }
      };
    }
  }

  private async auditConfiguration(): Promise<any> {
    try {
      logger.debug('Auditing configuration');
      
      const issues = [];
      
      // Check environment variables
      const requiredEnvVars = [
        'JWT_SECRET',
        'SUPABASE_SERVICE_ROLE_KEY',
        'REDIS_PASSWORD'
      ];

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          issues.push(`Missing required environment variable: ${envVar}`);
        }
      }

      // Check for weak JWT secret
      if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        issues.push('JWT secret is too short (should be at least 32 characters)');
      }

      // Check for default passwords
      if (process.env.REDIS_PASSWORD === 'password' || process.env.REDIS_PASSWORD === 'redis') {
        issues.push('Default Redis password detected');
      }

      const score = issues.length === 0 ? 100 : 
                   issues.length < 3 ? 80 : 
                   issues.length < 5 ? 60 : 40;

      return {
        category: 'configuration',
        score,
        issues: issues.length,
        details: {
          configurationIssues: issues,
          checkedVariables: requiredEnvVars.length
        }
      };
    } catch (error) {
      logger.error('Failed to audit configuration:', error);
      return {
        category: 'configuration',
        score: 0,
        issues: 999,
        details: { error: error.message }
      };
    }
  }

  private async auditAuthentication(): Promise<any> {
    try {
      logger.debug('Auditing authentication');
      
      const issues = [];
      
      // Check password policies
      const passwordPolicyIssues = await this.checkPasswordPolicies();
      issues.push(...passwordPolicyIssues);

      // Check session management
      const sessionIssues = await this.checkSessionManagement();
      issues.push(...sessionIssues);

      // Check for MFA implementation
      const mfaIssues = await this.checkMFAImplementation();
      issues.push(...mfaIssues);

      const score = issues.length === 0 ? 100 : 
                   issues.length < 3 ? 80 : 
                   issues.length < 5 ? 60 : 40;

      return {
        category: 'authentication',
        score,
        issues: issues.length,
        details: {
          authenticationIssues: issues
        }
      };
    } catch (error) {
      logger.error('Failed to audit authentication:', error);
      return {
        category: 'authentication',
        score: 0,
        issues: 999,
        details: { error: error.message }
      };
    }
  }

  private async auditDataSecurity(): Promise<any> {
    try {
      logger.debug('Auditing data security');
      
      const issues = [];
      
      // Check encryption at rest
      const encryptionIssues = await this.checkEncryptionAtRest();
      issues.push(...encryptionIssues);

      // Check encryption in transit
      const transitIssues = await this.checkEncryptionInTransit();
      issues.push(...transitIssues);

      // Check data retention policies
      const retentionIssues = await this.checkDataRetentionPolicies();
      issues.push(...retentionIssues);

      const score = issues.length === 0 ? 100 : 
                   issues.length < 3 ? 80 : 
                   issues.length < 5 ? 60 : 40;

      return {
        category: 'data',
        score,
        issues: issues.length,
        details: {
          dataSecurityIssues: issues
        }
      };
    } catch (error) {
      logger.error('Failed to audit data security:', error);
      return {
        category: 'data',
        score: 0,
        issues: 999,
        details: { error: error.message }
      };
    }
  }

  // Vulnerability scanning methods
  private async scanSQLInjection(target: string): Promise<any[]> {
    // Implementation would include SQL injection testing
    return [];
  }

  private async scanXSS(target: string): Promise<any[]> {
    // Implementation would include XSS testing
    return [];
  }

  private async scanCSRF(target: string): Promise<any[]> {
    // Implementation would include CSRF testing
    return [];
  }

  private async scanAuthenticationFlaws(target: string): Promise<any[]> {
    // Implementation would include authentication testing
    return [];
  }

  private async scanInputValidation(target: string): Promise<any[]> {
    // Implementation would include input validation testing
    return [];
  }

  private async scanEncryptionIssues(target: string): Promise<any[]> {
    // Implementation would include encryption testing
    return [];
  }

  // Helper methods
  private calculateOverallScore(categoryScores: any[]): number {
    if (categoryScores.length === 0) return 0;
    
    const totalScore = categoryScores.reduce((sum, category) => sum + category.score, 0);
    return Math.round(totalScore / categoryScores.length);
  }

  private async getComplianceStatus(): Promise<any> {
    return {
      gdpr: { status: 'pending', score: 0 },
      pciDss: { status: 'pending', score: 0 },
      iso27001: { status: 'pending', score: 0 },
      owasp: { status: 'pending', score: 0 }
    };
  }

  private async storeAuditResult(result: SecurityAuditResult): Promise<void> {
    try {
      await this.supabase
        .from('security_audits')
        .insert({
          id: result.id,
          timestamp: result.timestamp.toISOString(),
          duration: result.duration,
          overall_score: result.overallScore,
          categories: result.categories,
          vulnerabilities: result.vulnerabilities,
          recommendations: result.recommendations,
          compliance: result.compliance
        });
    } catch (error) {
      logger.error('Failed to store audit result:', error);
    }
  }

  private async storeVulnerabilityReport(report: VulnerabilityReport): Promise<void> {
    try {
      await this.supabase
        .from('vulnerability_reports')
        .insert({
          id: report.id,
          target: report.target,
          timestamp: report.timestamp.toISOString(),
          duration: report.duration,
          vulnerabilities: report.vulnerabilities,
          summary: report.summary,
          recommendations: report.recommendations
        });
    } catch (error) {
      logger.error('Failed to store vulnerability report:', error);
    }
  }

  private async storeComplianceReport(report: ComplianceReport): Promise<void> {
    try {
      await this.supabase
        .from('compliance_reports')
        .insert({
          id: report.id,
          framework: report.framework,
          timestamp: report.timestamp.toISOString(),
          duration: report.duration,
          overall_score: report.overallScore,
          checks: report.checks,
          summary: report.summary,
          recommendations: report.recommendations
        });
    } catch (error) {
      logger.error('Failed to store compliance report:', error);
    }
  }

  private async updateSecurityMetrics(result: SecurityAuditResult): Promise<void> {
    try {
      const metrics = {
        timestamp: new Date(),
        overallScore: result.overallScore,
        vulnerabilities: result.vulnerabilities.length,
        recommendations: result.recommendations.length,
        categories: result.categories
      };

      await this.redis.setex(
        'security_metrics:latest',
        3600,
        JSON.stringify(metrics)
      );
    } catch (error) {
      logger.error('Failed to update security metrics:', error);
    }
  }

  // Placeholder methods for detailed checks
  private async checkPasswordPolicies(): Promise<string[]> {
    return [];
  }

  private async checkSessionManagement(): Promise<string[]> {
    return [];
  }

  private async checkMFAImplementation(): Promise<string[]> {
    return ['MFA not implemented'];
  }

  private async checkEncryptionAtRest(): Promise<string[]> {
    return [];
  }

  private async checkEncryptionInTransit(): Promise<string[]> {
    return [];
  }

  private async checkDataRetentionPolicies(): Promise<string[]> {
    return [];
  }

  private async performGDPRChecks(): Promise<any[]> {
    return [];
  }

  private async performPCIDSSChecks(): Promise<any[]> {
    return [];
  }

  private async performISO27001Checks(): Promise<any[]> {
    return [];
  }

  private async performOWASPChecks(): Promise<any[]> {
    return [];
  }

  private generateVulnerabilityRecommendations(vulnerabilities: any[]): string[] {
    return [];
  }

  private generateComplianceRecommendations(checks: any[]): string[] {
    return [];
  }

  // Scheduled tasks
  private async scheduleDailySecurityScan(): Promise<void> {
    await this.auditQueue.add('security-scan', {
      scanType: 'daily',
      target: 'all_services'
    });
  }

  private async scheduleWeeklyVulnerabilityAssessment(): Promise<void> {
    await this.auditQueue.add('vulnerability-assessment', {
      target: 'all_services'
    });
  }

  private async scheduleMonthlyComplianceCheck(): Promise<void> {
    await this.auditQueue.add('compliance-check', {
      framework: 'owasp'
    });
  }

  private async performSecurityScan(scanType: string, target: string): Promise<void> {
    logger.info(`Performing ${scanType} security scan on ${target}`);
    // Implementation would perform actual security scanning
  }

  private async performVulnerabilityAssessment(target: string): Promise<void> {
    logger.info(`Performing vulnerability assessment on ${target}`);
    // Implementation would perform actual vulnerability assessment
  }

  private async performComplianceCheck(framework: string): Promise<void> {
    logger.info(`Performing compliance check for ${framework}`);
    // Implementation would perform actual compliance checking
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async shutdown(): Promise<void> {
    try {
      // Stop cron jobs
      this.cronJobs.forEach(job => job.stop());
      
      // Close queue
      await this.auditQueue.close();
      
      // Close Redis connection
      await this.redis.quit();
      
      logger.info('Security audit service shut down successfully');
    } catch (error) {
      logger.error('Failed to shutdown security audit service:', error);
    }
  }
}

export default SecurityAuditService;