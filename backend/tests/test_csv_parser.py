"""
Unit tests for CSV parsing.

Use cases:
- A user uploads an orders CSV and an assets CSV
- The system should extract all required fields correctly
- Swapped lat/lon columns should be handled transparently
- Missing or malformed data should raise clear errors
"""

import pytest
from app.services.csv_parser import parse_orders_csv, parse_assets_csv


class TestParseOrdersCsv:
    def test_parses_correct_number_of_orders(self, sample_orders_csv):
        orders, _ = parse_orders_csv(sample_orders_csv)
        assert len(orders) == 3

    def test_work_order_numbers_extracted(self, sample_orders_csv):
        orders, _ = parse_orders_csv(sample_orders_csv)
        wo_numbers = {o.work_order_number for o in orders}
        assert "WO001" in wo_numbers
        assert "WO002" in wo_numbers
        assert "WO003" in wo_numbers

    def test_order_type_preserved(self, sample_orders_csv):
        orders, _ = parse_orders_csv(sample_orders_csv)
        types = {o.work_order_number: o.order_type for o in orders}
        assert types["WO001"] == "Dry"
        assert types["WO002"] == "Cold"

    def test_coordinates_are_valid_nyc(self, sample_orders_csv):
        """Coordinates should be in the NYC metro area after swap handling."""
        orders, _ = parse_orders_csv(sample_orders_csv)
        for order in orders:
            # After parsing, lat should be ~40.x, lon should be ~-73.x
            assert 40.0 < order.latitude < 41.5, f"Bad latitude: {order.latitude}"
            assert -74.5 < order.longitude < -73.0, f"Bad longitude: {order.longitude}"

    def test_time_windows_in_minutes(self, sample_orders_csv):
        orders, _ = parse_orders_csv(sample_orders_csv)
        for order in orders:
            assert order.open_time >= 0
            assert order.close_time > order.open_time
            assert order.close_time <= 1440  # max minutes in a day

    def test_pallets_are_positive(self, sample_orders_csv):
        orders, _ = parse_orders_csv(sample_orders_csv)
        for order in orders:
            assert order.total_pallets >= 0

    def test_inline_instructions_returned(self, sample_orders_csv):
        """Even if no instructions column exists, should return empty string."""
        _, instructions = parse_orders_csv(sample_orders_csv)
        assert isinstance(instructions, str)

    def test_empty_csv_raises_error(self):
        with pytest.raises(Exception):
            parse_orders_csv(b"")

    def test_csv_with_only_headers_raises_error(self):
        header = (
            "Work Order Number,Customer Number,Name,Address,City,State,Zip,"
            "Longitude,Latitude,Open1,Close1,FixedTime,"
            "Food Pallets, Pet Food Pallets,Chemical Pallets\n"
        ).encode()
        with pytest.raises(Exception):
            parse_orders_csv(header)


class TestParseAssetsCsv:
    def test_parses_correct_number_of_vehicles(self, sample_assets_csv):
        vehicles = parse_assets_csv(sample_assets_csv)
        assert len(vehicles) == 3

    def test_vehicle_names_extracted(self, sample_assets_csv):
        vehicles = parse_assets_csv(sample_assets_csv)
        names = {v.name for v in vehicles}
        assert "FB-1" in names
        assert "FB-101" in names

    def test_capacity_values_positive(self, sample_assets_csv):
        vehicles = parse_assets_csv(sample_assets_csv)
        for v in vehicles:
            assert v.capacity > 0

    def test_empty_assets_raises_error(self):
        with pytest.raises(Exception):
            parse_assets_csv(b"")
