import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface RevenueData {
  month: string;
  revenue: number;
  target?: number;
}

interface RevenueChartProps {
  data: RevenueData[];
  title?: string;
}

export default function RevenueChart({ data, title = "Évolution du chiffre d'affaires" }: RevenueChartProps) {
  console.log('RevenueChart rendered with data:', data);
  
  if (!data || data.length === 0) {
    return (
      <div className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400">Aucune donnée disponible</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      <div className="w-full h-[300px]">
        <LineChart width={800} height={300} data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="month" 
            stroke="#6b7280" 
            fontSize={12}
          />
          <YAxis 
            stroke="#6b7280" 
            fontSize={12}
          />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="revenue" 
            stroke="#185FA5" 
            strokeWidth={2}
            name="Chiffre d'affaires"
          />
          {data.some(d => d.target) && (
            <Line 
              type="monotone" 
              dataKey="target" 
              stroke="#5DCAA5" 
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Objectif"
            />
          )}
        </LineChart>
      </div>
    </div>
  );
}
