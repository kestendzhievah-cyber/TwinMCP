export interface Alert {
  id?: string;
  name: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  labels?: Record<string, string>;
  timestamp?: Date;
}

export class AlertManager {
  private alerts: Alert[] = [];
  private notificationCallbacks: ((alert: Alert) => void)[] = [];

  async createAlert(alert: Alert): Promise<void> {
    const fullAlert: Alert = {
      ...alert,
      timestamp: new Date(),
      id: crypto.randomUUID()
    };

    this.alerts.push(fullAlert);
    
    // Envoyer les notifications
    await this.sendNotifications(fullAlert);
  }

  async getAlerts(severity?: string, limit = 100): Promise<Alert[]> {
    let filteredAlerts = this.alerts;
    
    if (severity) {
      filteredAlerts = this.alerts.filter(alert => alert.severity === severity);
    }

    return filteredAlerts
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, limit);
  }

  addNotificationCallback(callback: (alert: Alert) => void): void {
    this.notificationCallbacks.push(callback);
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    for (const callback of this.notificationCallbacks) {
      try {
        await callback(alert);
      } catch (error) {
        console.error('Notification callback failed:', error);
      }
    }
  }

  clearAlerts(): void {
    this.alerts = [];
  }
}
