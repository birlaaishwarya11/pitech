# piTech Route Optimization - Next.js Integration

A modern Next.js web frontend for the piTech Route Optimization backend API.

## Features

- **Route Optimization**: Upload orders and assets files to optimize delivery routes
- **Real-time Results**: View optimized routes with detailed stop information
- **Route Modification**: Delete stops from routes and regenerate optimization
- **Multiple Format Support**: CSV and Excel file uploads
- **Special Instructions**: Support for skip, lock, priority, and window directives

## Prerequisites

- Node.js 18+ 
- npm or yarn
- piTech backend API running on `http://localhost:8000` (configurable)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure the API URL (optional):
   - Copy `.env.example` to `.env.local`
   - Update `NEXT_PUBLIC_API_URL` if your backend is on a different host/port

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles with Tailwind
├── components/
│   └── OptimizationForm.tsx # Main UI component
├── hooks/
│   └── useApi.ts           # React hooks for API calls
├── lib/
│   ├── api-config.ts       # API configuration
│   └── types.ts            # TypeScript type definitions
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── next.config.js          # Next.js configuration
└── postcss.config.js       # PostCSS configuration
```

## API Integration

The application uses two main API endpoints:

### POST `/api/v1/optimize`
Runs route optimization on uploaded files.

**Request:**
- `orders_file`: CSV or Excel file with order data
- `assets_file`: CSV file with vehicle/asset data
- `use_ors`: (Optional) Use OpenRouteService (default: true)
- `special_instructions`: (Optional) Routing directives

**Response:**
```typescript
{
  status: string;
  solver_status: string;
  total_orders: number;
  total_stops: number;
  assigned_orders: number;
  unassigned_orders: number;
  routes_used: number;
  vehicles_available: number;
  routes: RouteResult[];
  unassigned: OrderRecord[];
}
```

### POST `/api/v1/delete-stop`
Deletes a stop from an optimized route.

**Request:**
```typescript
{
  vehicle_id: string;
  stop_index: number;
  reason?: string;
}
```

**Response:**
```typescript
{
  vehicle_id: string;
  deleted_stop_index: number;
  updated_route: unknown[];
  total_distance?: number;
  total_time?: number;
  message: string;
}
```

## Usage

1. **Upload Files**:
   - Select an Orders CSV/Excel file containing customer orders
   - Select an Assets CSV file containing vehicle information

2. **Configure Options**:
   - Toggle "Use OpenRouteService" for more accurate distance calculations
   - Enter special instructions for specific routing rules

3. **Optimize Routes**:
   - Click "Optimize Routes" to run the optimization algorithm
   - View results including route assignments and stop sequences

4. **Modify Routes** (Optional):
   - Select a vehicle and stop index
   - Click "Delete Stop" to remove a stop from the route

## Environment Variables

- `NEXT_PUBLIC_API_URL`: Backend API base URL (default: `http://localhost:8000`)

## Build for Production

```bash
npm run build
npm run start
```

## Development

- **Lint**: `npm run lint`
- **Format**: Consider adding Prettier for code formatting
- **Type Check**: TypeScript is configured for strict type checking

## Technologies

- **Next.js 15**: React framework with App Router
- **React 18**: UI components and state management
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **PostCSS**: CSS processing with autoprefixer

## Troubleshooting

### API Connection Errors
- Ensure the piTech backend is running
- Check that `NEXT_PUBLIC_API_URL` points to the correct backend host/port
- Check browser console for CORS-related errors

### File Upload Issues
- Ensure files are in correct format (CSV or Excel for orders, CSV for assets)
- Check file size limits in the backend API

### Build Errors
- Run `npm install` to ensure all dependencies are installed
- Clear `.next` folder: `rm -rf .next`
- Check TypeScript errors: `npx tsc --noEmit`

## License

See LICENSE file in the root directory.
