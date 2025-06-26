import { useState, useEffect } from 'react';
import { LineChart, BarChart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { notificationSystem } from '../../lib/notifications';

interface Metrics {
  date: string;
  total_sent: number;
  successful_delivery: number;
  failed_delivery: number;
  average_latency: number;
}

export function MetricsDashboard() {
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'chart' | 'table'>('chart');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data, error } = await supabase
          .from('notification_metrics')
          .select('*')
          .order('date', { ascending: false })
          .limit(30);

        if (error) throw error;
        setMetrics(data || []);
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const realtimeMetrics = notificationSystem.getMetrics();
  const successRate = metrics.length > 0
    ? (metrics.reduce((acc, m) => acc + m.successful_delivery, 0) / 
       metrics.reduce((acc, m) => acc + m.total_sent, 0)) * 100
    : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Notification Metrics</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView('chart')}
            className={`rounded-lg p-2 ${
              view === 'chart' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
            }`}
          >
            <LineChart className="h-5 w-5" />
          </button>
          <button
            onClick={() => setView('table')}
            className={`rounded-lg p-2 ${
              view === 'table' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
            }`}
          >
            <BarChart className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
          <p className="mt-2 text-3xl font-bold text-green-600">
            {successRate.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Average Latency</h3>
          <p className="mt-2 text-3xl font-bold text-blue-600">
            {realtimeMetrics.averageLatency.toFixed(0)}ms
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Total Sent (24h)</h3>
          <p className="mt-2 text-3xl font-bold">
            {metrics[0]?.total_sent || 0}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Failed Deliveries (24h)</h3>
          <p className="mt-2 text-3xl font-bold text-red-600">
            {metrics[0]?.failed_delivery || 0}
          </p>
        </div>
      </div>

      {/* Detailed View */}
      {view === 'table' ? (
        <div className="rounded-lg bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-sm font-medium text-gray-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Total Sent</th>
                  <th className="px-4 py-3">Successful</th>
                  <th className="px-4 py-3">Failed</th>
                  <th className="px-4 py-3">Avg. Latency</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.date} className="border-b">
                    <td className="px-4 py-3">{new Date(metric.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{metric.total_sent}</td>
                    <td className="px-4 py-3 text-green-600">{metric.successful_delivery}</td>
                    <td className="px-4 py-3 text-red-600">{metric.failed_delivery}</td>
                    <td className="px-4 py-3">{metric.average_latency.toFixed(0)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-white p-4 shadow-sm">
          {/* Add chart visualization here if needed */}
          <p className="text-center text-gray-500">
            Chart view coming soon
          </p>
        </div>
      )}
    </div>
  );
}