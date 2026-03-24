import { Badge } from "./ui/badge";

interface RouteData {
  vehicle: string;
  stops: number;
  loadPercent: number;
  remainingCapacity: number;
  totalCapacity: number;
  totalDistance: string;
  finishTime: string;
  status: "on-track" | "near-capacity" | "needs-review" | "over-capacity";
}

interface RouteSummaryTableProps {
  routes: RouteData[];
}

export function RouteSummaryTable({ routes }: RouteSummaryTableProps) {
  const getStatusBadge = (status: RouteData["status"]) => {
    switch (status) {
      case "on-track":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
            On Track
          </Badge>
        );
      case "near-capacity":
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">
            Near Capacity
          </Badge>
        );
      case "needs-review":
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">
            Needs Review
          </Badge>
        );
      case "over-capacity":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">
            Over Capacity
          </Badge>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Route Summary</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Vehicle
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Stops
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Load %
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Remaining Capacity
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Total Distance
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Finish Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {routes.map((route, idx) => (
              <tr
                key={idx}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {route.vehicle}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {route.stops}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 max-w-[100px] h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          route.loadPercent > 100
                            ? "bg-red-500"
                            : route.loadPercent > 90
                            ? "bg-orange-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width: `${Math.min(route.loadPercent, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-medium">{route.loadPercent}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  <span className="font-medium">{route.remainingCapacity}</span>
                  <span className="text-gray-500"> / {route.totalCapacity} pallets</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {route.totalDistance}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {route.finishTime}
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(route.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}