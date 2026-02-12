import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface QualityScore {
  overall: number;
  breakdown: {
    popularity: number;
    maintenance: number;
    documentation: number;
    testing: number;
    security: number;
    community: number;
  };
  grade: string;
  timestamp: Date;
}

interface LibraryWithMetrics {
  id: string;
  downloads?: number;
  githubStars?: number;
  githubForks?: number;
  lastUpdated: Date;
  versions?: any[];
  githubIssues?: number;
  githubOpenIssues?: number;
  readme?: string;
  documentationUrl?: string;
  examplesCount?: number;
  hasApiDocs?: boolean;
  hasChangelog?: boolean;
  hasTests?: boolean;
  testCoverage?: number;
  hasCiCd?: boolean;
  vulnerabilities?: any[];
  hasSecurityAudit?: boolean;
  contributorsCount?: number;
}

export class QualityScoreService {
  async calculateScore(libraryId: string): Promise<QualityScore> {
    const library = await this.getLibraryWithMetrics(libraryId);
    
    const scores = {
      popularity: this.calculatePopularityScore(library),
      maintenance: this.calculateMaintenanceScore(library),
      documentation: this.calculateDocumentationScore(library),
      testing: this.calculateTestingScore(library),
      security: this.calculateSecurityScore(library),
      community: this.calculateCommunityScore(library)
    };
    
    const weights = {
      popularity: 0.2,
      maintenance: 0.25,
      documentation: 0.15,
      testing: 0.15,
      security: 0.15,
      community: 0.1
    };
    
    const finalScore = Object.entries(scores).reduce(
      (total, [key, value]) => total + value * weights[key as keyof typeof weights],
      0
    );
    
    return {
      overall: finalScore,
      breakdown: scores,
      grade: this.getGrade(finalScore),
      timestamp: new Date()
    };
  }
  
  private async getLibraryWithMetrics(libraryId: string): Promise<LibraryWithMetrics> {
    const library = await prisma.library.findUnique({
      where: { id: libraryId },
      include: {
        versions: true
      }
    });
    
    if (!library) {
      throw new Error(`Library ${libraryId} not found`);
    }
    
    return library as any;
  }
  
  private calculatePopularityScore(library: LibraryWithMetrics): number {
    const downloads = library.downloads || 0;
    const stars = library.githubStars || 0;
    const forks = library.githubForks || 0;
    
    const downloadScore = Math.min(100, Math.log10(downloads + 1) * 10);
    const starScore = Math.min(100, Math.log10(stars + 1) * 20);
    const forkScore = Math.min(100, Math.log10(forks + 1) * 15);
    
    return (downloadScore * 0.5 + starScore * 0.3 + forkScore * 0.2) / 100;
  }
  
  private calculateMaintenanceScore(library: LibraryWithMetrics): number {
    const now = new Date();
    const lastUpdate = new Date(library.lastUpdated);
    const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    
    let updateScore = 100;
    if (daysSinceUpdate > 365) updateScore = 20;
    else if (daysSinceUpdate > 180) updateScore = 50;
    else if (daysSinceUpdate > 90) updateScore = 70;
    else if (daysSinceUpdate > 30) updateScore = 90;
    
    const releaseFrequency = library.versions?.length || 0;
    const frequencyScore = Math.min(100, releaseFrequency * 5);
    
    const totalIssues = library.githubIssues || 0;
    const openIssues = library.githubOpenIssues || 0;
    const issueScore = totalIssues > 0 
      ? (1 - (openIssues / totalIssues)) * 100 
      : 50;
    
    return (updateScore * 0.4 + frequencyScore * 0.3 + issueScore * 0.3) / 100;
  }
  
  private calculateDocumentationScore(library: LibraryWithMetrics): number {
    let score = 0;
    
    if (library.readme && library.readme.length > 500) score += 30;
    else if (library.readme) score += 15;
    
    if (library.documentationUrl) score += 25;
    
    if (library.examplesCount && library.examplesCount > 0) score += 20;
    
    if (library.hasApiDocs) score += 15;
    
    if (library.hasChangelog) score += 10;
    
    return score / 100;
  }
  
  private calculateTestingScore(library: LibraryWithMetrics): number {
    let score = 0;
    
    if (library.hasTests) score += 40;
    
    if (library.testCoverage) {
      score += library.testCoverage * 0.4;
    }
    
    if (library.hasCiCd) score += 20;
    
    return score / 100;
  }
  
  private calculateSecurityScore(library: LibraryWithMetrics): number {
    let score = 100;
    
    const vulnerabilities = library.vulnerabilities || [];
    vulnerabilities.forEach((vuln: any) => {
      if (vuln.severity === 'critical') score -= 30;
      else if (vuln.severity === 'high') score -= 20;
      else if (vuln.severity === 'medium') score -= 10;
      else if (vuln.severity === 'low') score -= 5;
    });
    
    if (library.hasSecurityAudit) score += 10;
    
    return Math.max(0, score) / 100;
  }
  
  private calculateCommunityScore(library: LibraryWithMetrics): number {
    const contributors = library.contributorsCount || 0;
    const stars = library.githubStars || 0;
    const forks = library.githubForks || 0;
    
    const contributorScore = Math.min(40, contributors * 2);
    const starScore = Math.min(30, Math.log10(stars + 1) * 6);
    const forkScore = Math.min(30, Math.log10(forks + 1) * 6);
    
    return (contributorScore + starScore + forkScore) / 100;
  }
  
  private getGrade(score: number): string {
    if (score >= 0.9) return 'A+';
    if (score >= 0.8) return 'A';
    if (score >= 0.7) return 'B';
    if (score >= 0.6) return 'C';
    if (score >= 0.5) return 'D';
    return 'F';
  }
}
