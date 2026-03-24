# Dynamic Optimizer Parameters Setup

## Overview
The piTech Route Optimization system now includes a dynamic parameter configuration system that allows you to customize optimizer behaviors throughout your session.

## Features

### Backend Changes
1. **New Parameters Model** (`backend/models/optimizer_params.py`)
   - Defines all configurable optimization parameters
   - Includes validation constraints on each parameter
   - Parameters are validated at both the Pydantic and business logic levels

2. **Parameters Router** (`backend/routers/parameters.py`)
   - `GET /api/v1/parameters?session_id=default` - Get current session parameters
   - `POST /api/v1/parameters?session_id=default` - Update session parameters
   - `POST /api/v1/parameters/reset?session_id=default` - Reset to defaults
   - `GET /api/v1/parameters/defaults` - View default configuration values

3. **Dynamic Parameters Supported**
   - **Solver Wave 1**: time limit, max vehicle time, max waiting time, drop penalty
   - **Solver Wave 2**: reload buffer, cutoff time, time limit
   - **Time Windows**: depot opening/closing times, service time per stop
   - **Routing**: OpenRouteService toggle, matrix batch size

### Frontend Changes

1. **Session Parameters Context** (`frontend/lib/params-context.tsx`)
   - Manages optimizer parameters globally across the application
   - Provides hooks for fetching, updating, and resetting parameters
   - Maintains session state throughout the user session

2. **Settings Page** (`frontend/app/settings/page.tsx`)
   - User-friendly interface to modify all optimizer parameters
   - Real-time validation feedback
   - Save/reset buttons with success/error messages
   - Organized into logical sections:
     - Solver Wave 1 settings
     - Solver Wave 2 settings
     - Time window configuration
     - Routing options

3. **Navigation**
   - Main optimization page now has a Settings button (gear icon)
   - Settings page has a back button to return to optimization

## Usage

### For Users

1. **Access Settings**
   - Click the ⚙ Settings button on the main Route Optimization page
   - Or navigate directly to `/settings`

2. **Modify Parameters**
   - Adjust any parameter in the form
   - Each parameter has validation constraints shown in the form
   - Description text explains what each parameter does

3. **Save Changes**
   - Click "Save Parameters" to persist changes for the session
   - Changes apply to all future optimizations in the session
   - Click "Reset to Defaults" to revert all changes

### For Developers

1. **Accessing Parameters in Code**
   ```typescript
   const { params, updateParams } = useParams();
   
   // Get current parameters
   console.log(params);
   
   // Update parameters
   await updateParams({
     ...params,
     solver_time_limit_seconds: 300
   });
   ```

2. **Backend Integration**
   - Parameters are stored in memory (in-memory cache)
   - In production, consider using Redis or a database
   - Session IDs allow different sessions to have different parameters

3. **API Integration**
   ```typescript
   // Get parameters
   const response = await fetch('/api/v1/parameters?session_id=default');
   
   // Update parameters
   const response = await fetch('/api/v1/parameters?session_id=default', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       solver_time_limit_seconds: 300,
       // ... other parameters
     })
   });
   ```

## Parameter Ranges and Descriptions

### Solver Parameters
- **Solver Time Limit**: 10-600 seconds (default: 180)
  - How long the solver can run before returning a solution
  
- **Max Vehicle Time**: 60-1440 minutes (default: 600)
  - Maximum hours a vehicle can be on the road
  
- **Max Waiting Time**: 0-600 minutes (default: 300)
  - Maximum idle/waiting time allowed
  
- **Drop Penalty**: 100+ (default: 1,000,000)
  - Penalty for leaving an order unassigned (higher = minimize drops)

### Wave 2 Parameters
- **Reload Buffer**: 0-120 minutes (default: 30)
  - Turnaround time at depot between wave 1 and wave 2
  
- **Wave 2 Cutoff**: 300-1440 minutes (default: 960 = 4 PM)
  - Latest time wave 2 optimization can start
  
- **Wave 2 Time Limit**: 10-300 seconds (default: 90)
  - Time allowed for the second dispatch optimization

### Time Windows
- **Depot Open**: 0-1440 minutes (default: 480 = 8:00 AM)
- **Depot Close**: 0-1440 minutes (default: 1020 = 5:00 PM)
- **Service Time**: 5-120 minutes (default: 30)
  - Time spent at each delivery location

### Routing Options
- **Use ORS**: True/False (default: True)
  - Use real routing distances vs straight-line distances
  
- **ORS Batch Size**: 10-100 (default: 50)
  - How many location pairs to batch in API calls

## Session Management

The system supports multiple sessions via the `session_id` parameter. Each session can have different parameter configurations:

```
GET /api/v1/parameters?session_id=user123
GET /api/v1/parameters?session_id=user456
```

In the current implementation, sessions are stored in memory and will reset when the server restarts. For production, consider:
- Using Redis for distributed session management
- Database storage with TTL (time-to-live)
- User-specific parameter persistence

## Next Steps

1. **Frontend Integration**: Update the OptimizationForm to automatically use session parameters when making optimization requests
2. **Backend Integration**: Modify the solver to accept and use dynamic parameters instead of static config
3. **Database Persistence**: Move session storage from in-memory to a persistent store
4. **User Accounts**: Tie sessions to user accounts for personal parameter preferences
