import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

interface BackendSettings {
  depotLat: number;
  depotLng: number;
  solverTimeLimit: number;
  maxVehicleTime: number;
  maxWaitingTime: number;
  depotOpenMinutes: number;
  depotCloseMinutes: number;
  defaultServiceTime: number;
  palletScale: number;
  orsApiKey: string;
  orsBaseUrl: string;
  orsMatrixBatchSize: number;
  dropPenalty: number;
  wave2ReloadBuffer: number;
  wave2CutoffMinutes: number;
  wave2SolverTimeLimit: number;
}

const defaultSettings: BackendSettings = {
  depotLat: 40.8094,
  depotLng: -73.8796,
  solverTimeLimit: 180,
  maxVehicleTime: 600,
  maxWaitingTime: 300,
  depotOpenMinutes: 480,
  depotCloseMinutes: 1020,
  defaultServiceTime: 30,
  palletScale: 100,
  orsApiKey: "",
  orsBaseUrl: "https://api.openrouteservice.org",
  orsMatrixBatchSize: 50,
  dropPenalty: 1000000,
  wave2ReloadBuffer: 30,
  wave2CutoffMinutes: 960,
  wave2SolverTimeLimit: 90,
};

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<BackendSettings>(defaultSettings);

  useEffect(() => {
    const saved = localStorage.getItem("backendSettings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (error) {
        console.error("Failed to parse saved settings:", error);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("backendSettings", JSON.stringify(settings));
    toast.success("Settings saved successfully");
  };

  const handleInputChange = (field: keyof BackendSettings, value: string | number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const parseTime = (timeStr: string) => {
    const [hours, mins] = timeStr.split(':').map(Number);
    return hours * 60 + mins;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Route Optimization</span>
              </Button>
            </div>
            <Button onClick={handleSave} className="flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>Save Settings</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Backend Settings</h1>
          <p className="text-gray-600 mt-2">
            Configure parameters for the route optimization backend. These settings persist across sessions.
          </p>
        </div>

        <div className="space-y-6">
          {/* Depot Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Depot Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="depotOpen">Depot Open Time</Label>
                  <Input
                    id="depotOpen"
                    type="time"
                    value={formatTime(settings.depotOpenMinutes)}
                    onChange={(e) => handleInputChange("depotOpenMinutes", parseTime(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="depotClose">Depot Close Time</Label>
                  <Input
                    id="depotClose"
                    type="time"
                    value={formatTime(settings.depotCloseMinutes)}
                    onChange={(e) => handleInputChange("depotCloseMinutes", parseTime(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Solver Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Solver Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxVehicleTime">Max Vehicle Time (minutes)</Label>
                  <Input
                    id="maxVehicleTime"
                    type="number"
                    value={settings.maxVehicleTime}
                    onChange={(e) => handleInputChange("maxVehicleTime", parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="maxWaitingTime">Max Waiting Time (minutes)</Label>
                  <Input
                    id="maxWaitingTime"
                    type="number"
                    value={settings.maxWaitingTime}
                    onChange={(e) => handleInputChange("maxWaitingTime", parseInt(e.target.value))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="defaultServiceTime">Default Service Time (minutes)</Label>
                  <Input
                    id="defaultServiceTime"
                    type="number"
                    value={settings.defaultServiceTime}
                    onChange={(e) => handleInputChange("defaultServiceTime", parseInt(e.target.value))}
                  />
                </div>
                <div>
                    <Label htmlFor="dropPenalty">Drop Penalty</Label>
                    <Input
                    id="dropPenalty"
                    type="number"
                    value={settings.dropPenalty}
                    onChange={(e) => handleInputChange("dropPenalty", parseInt(e.target.value))}
                    />
                </div>
              </div>
              
            </CardContent>
          </Card>

          {/* OpenRouteService Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>OpenRouteService Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="orsApiKey">ORS API Key</Label>
                <Input
                  id="orsApiKey"
                  type="password"
                  value={settings.orsApiKey}
                  onChange={(e) => handleInputChange("orsApiKey", e.target.value)}
                  placeholder="Enter your OpenRouteService API key"
                />
              </div>
              <div>
                <Label htmlFor="orsBaseUrl">ORS Base URL</Label>
                <Input
                  id="orsBaseUrl"
                  value={settings.orsBaseUrl}
                  onChange={(e) => handleInputChange("orsBaseUrl", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="orsMatrixBatchSize">Matrix Batch Size</Label>
                <Input
                  id="orsMatrixBatchSize"
                  type="number"
                  value={settings.orsMatrixBatchSize}
                  onChange={(e) => handleInputChange("orsMatrixBatchSize", parseInt(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Wave 2 Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Wave 2 Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wave2ReloadBuffer">Reload Buffer (minutes)</Label>
                  <Input
                    id="wave2ReloadBuffer"
                    type="number"
                    value={settings.wave2ReloadBuffer}
                    onChange={(e) => handleInputChange("wave2ReloadBuffer", parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="wave2CutoffMinutes">Cutoff Time (minutes from midnight)</Label>
                  <Input
                    id="wave2CutoffMinutes"
                    type="number"
                    value={settings.wave2CutoffMinutes}
                    onChange={(e) => handleInputChange("wave2CutoffMinutes", parseInt(e.target.value))}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Equivalent to {formatTime(settings.wave2CutoffMinutes)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Other Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Other Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="palletScale">Pallet Scale</Label>
                <Input
                  id="palletScale"
                  type="number"
                  value={settings.palletScale}
                  onChange={(e) => handleInputChange("palletScale", parseInt(e.target.value))}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Scaling factor for pallet quantities in the solver
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}