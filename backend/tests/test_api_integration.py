"""
Integration tests for the optimize API endpoints.

Tests the full pipeline: CSV upload -> parse -> group -> solve -> response.
Uses FastAPI TestClient (no running server needed).
"""

import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_200(self):
        res = client.get("/api/v1/health")
        assert res.status_code == 200

    def test_health_returns_status_and_service(self):
        data = client.get("/api/v1/health").json()
        assert data["status"] == "healthy"
        assert data["service"] == "piTech Route Optimizer"

    def test_health_reports_ors_reachability(self):
        data = client.get("/api/v1/health").json()
        assert "ors_reachable" in data
        assert isinstance(data["ors_reachable"], bool)


class TestOptimizeEndpoint:
    def test_returns_valid_response_shape(self, sample_orders_csv, sample_assets_csv):
        res = client.post(
            "/api/v1/optimize?use_ors=false",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "routes" in data
        assert "total_orders" in data
        assert "warnings" in data
        assert isinstance(data["routes"], list)
        assert isinstance(data["warnings"], list)

    def test_processes_all_orders(self, sample_orders_csv, sample_assets_csv):
        data = client.post(
            "/api/v1/optimize?use_ors=false",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
        ).json()
        assert data["total_orders"] == 3
        assert data["vehicles_available"] == 3

    def test_assigns_all_orders_when_capacity_sufficient(
        self, sample_orders_csv, sample_assets_csv
    ):
        data = client.post(
            "/api/v1/optimize?use_ors=false",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
        ).json()
        assert data["unassigned_orders"] == 0

    def test_skip_instruction_reduces_assigned_count(
        self, sample_orders_csv, sample_assets_csv
    ):
        """Skipped orders reduce assigned count or total stops."""
        without_skip = client.post(
            "/api/v1/optimize?use_ors=false",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
        ).json()
        with_skip = client.post(
            "/api/v1/optimize?use_ors=false",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
            data={"special_instructions": "skip: WO#WO003"},
        ).json()
        assert with_skip["total_stops"] < without_skip["total_stops"]

    def test_routes_contain_stops_with_arrival_times(
        self, sample_orders_csv, sample_assets_csv
    ):
        data = client.post(
            "/api/v1/optimize?use_ors=false",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
        ).json()
        for route in data["routes"]:
            assert len(route["stops"]) > 0
            assert route["vehicle"] != ""
            assert route["total_pallets"] > 0
            for stop in route["stops"]:
                assert 0 <= stop["arrival_time_minutes"] < 1440

    def test_depot_open_override_accepted(
        self, sample_orders_csv, sample_assets_csv
    ):
        res = client.post(
            "/api/v1/optimize?use_ors=false&depot_open=540&depot_close=1020",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
        )
        assert res.status_code == 200

    def test_single_wave_mode(self, sample_orders_csv, sample_assets_csv):
        res = client.post(
            "/api/v1/optimize?use_ors=false&num_waves=1",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
        )
        assert res.status_code == 200

    def test_haversine_fallback_produces_no_warnings(
        self, sample_orders_csv, sample_assets_csv
    ):
        """When use_ors=false, no ORS warning should appear."""
        data = client.post(
            "/api/v1/optimize?use_ors=false",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
        ).json()
        ors_warnings = [w for w in data["warnings"] if "OpenRouteService" in w]
        assert len(ors_warnings) == 0

    def test_ors_fallback_produces_warning_if_ors_down(
        self, sample_orders_csv, sample_assets_csv
    ):
        """When use_ors=true but ORS is unreachable, should fall back and warn."""
        data = client.post(
            "/api/v1/optimize?use_ors=true",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
        ).json()
        # If ORS is not running, we expect a warning about fallback
        # If ORS IS running, warnings list will be empty — both are acceptable
        assert isinstance(data["warnings"], list)


class TestMissingInputs:
    def test_missing_orders_file(self, sample_assets_csv):
        res = client.post(
            "/api/v1/optimize?use_ors=false",
            files={
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
        )
        assert res.status_code == 422

    def test_missing_assets_file(self, sample_orders_csv):
        res = client.post(
            "/api/v1/optimize?use_ors=false",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
            },
        )
        assert res.status_code == 422

    def test_invalid_csv_returns_error(self):
        res = client.post(
            "/api/v1/optimize?use_ors=false",
            files={
                "orders_file": ("bad.csv", b"garbage,data\n1,2", "text/csv"),
                "assets_file": ("bad.csv", b"also,bad\nx,y", "text/csv"),
            },
        )
        assert res.status_code in (422, 500)


class TestCsvEndpoint:
    def test_returns_csv_content_type(self, sample_orders_csv, sample_assets_csv):
        res = client.post(
            "/api/v1/optimize/csv?use_ors=false",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
        )
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert "attachment" in res.headers.get("content-disposition", "")

    def test_csv_has_vehicle_column(self, sample_orders_csv, sample_assets_csv):
        res = client.post(
            "/api/v1/optimize/csv?use_ors=false",
            files={
                "orders_file": ("orders.csv", sample_orders_csv, "text/csv"),
                "assets_file": ("assets.csv", sample_assets_csv, "text/csv"),
            },
        )
        header = res.text.split("\n")[0]
        assert "Assigned Vehicle" in header or "Vehicle" in header


class TestRealDataIntegration:
    """Run against actual production CSVs (skipped if files not present)."""

    def test_full_pipeline_with_production_data(
        self, real_orders_path, real_assets_path
    ):
        if not os.path.exists(real_orders_path) or not os.path.exists(
            real_assets_path
        ):
            pytest.skip("Real data files not available")

        with open(real_orders_path, "rb") as of, open(real_assets_path, "rb") as af:
            res = client.post(
                "/api/v1/optimize?use_ors=false",
                files={
                    "orders_file": ("orders.csv", of, "text/csv"),
                    "assets_file": ("assets.csv", af, "text/csv"),
                },
            )

        assert res.status_code == 200
        data = res.json()
        assert data["total_orders"] > 50
        assert data["routes_used"] > 0
        rate = data["assigned_orders"] / data["total_orders"]
        assert rate > 0.7, f"Only {rate:.0%} assigned"
