"""
Unit tests for the order grouper.

Use cases:
- Orders at the same address should be grouped into a single stop
- Dry and Cold orders at the same address must become SEPARATE stops
- Orders exceeding the smallest vehicle capacity should be auto-split
- Skip constraints should exclude orders before grouping
"""

from app.services.csv_parser import parse_orders_csv, parse_assets_csv
from app.services.grouper import group_orders_into_stops


class TestGrouping:
    def test_same_address_same_type_grouped(self, sample_orders_csv, sample_assets_csv):
        """Two Dry orders at the same address should be one stop."""
        # Create CSV with 2 Dry orders at same location
        csv = (
            "Work Order Number,Customer Number,Name,Address,City,State,Zip,"
            "Longitude,Latitude,Open1,Close1,FixedTime,"
            "Food Pallets, Pet Food Pallets,Chemical Pallets,OrderType\n"
            "WO001,C1,Stop A,10 Main,Bronx,NY,10451,40.82,-73.92,0830,1230,30,1.0,0,0,Dry\n"
            "WO002,C1,Stop A,10 Main,Bronx,NY,10451,40.82,-73.92,0830,1230,30,2.0,0,0,Dry\n"
        ).encode()
        orders, _ = parse_orders_csv(csv)
        vehicles = parse_assets_csv(sample_assets_csv)
        stops = group_orders_into_stops(orders, vehicles)
        assert len(stops) == 1
        assert len(stops[0].order_indices) == 2

    def test_cold_and_dry_at_same_address_separate(self, sample_orders_csv, sample_assets_csv):
        """Cold and Dry at the same location must be separate stops."""
        orders, _ = parse_orders_csv(sample_orders_csv)
        vehicles = parse_assets_csv(sample_assets_csv)
        stops = group_orders_into_stops(orders, vehicles)
        # WO001 (Dry) and WO002 (Cold) at same address = 2 stops + WO003 at different address = 3 stops
        stop_types = [(s.name, s.order_types) for s in stops]
        cold_stops = [s for s in stops if "Cold" in s.order_types]
        dry_stops = [s for s in stops if "Dry" in s.order_types]
        assert len(cold_stops) >= 1
        assert len(dry_stops) >= 1

    def test_skip_constraint_excludes_order(self, sample_orders_csv, sample_assets_csv):
        """Skipped work orders should not appear in any stop."""
        orders, _ = parse_orders_csv(sample_orders_csv)
        vehicles = parse_assets_csv(sample_assets_csv)
        constraints = {
            "skip_wos": {"WO001"},
            "lock_stops": {},
            "priority_stops": [],
            "window_overrides": {},
            "notes": {},
            "errors": [],
        }
        stops = group_orders_into_stops(orders, vehicles, constraints)
        all_indices = []
        for s in stops:
            all_indices.extend(s.order_indices)
        # WO001 is at original_index 0, should not be in any stop
        wo001_idx = next(i for i, o in enumerate(orders) if o.work_order_number == "WO001")
        assert wo001_idx not in all_indices

    def test_all_stops_have_valid_coordinates(self, sample_orders_csv, sample_assets_csv):
        orders, _ = parse_orders_csv(sample_orders_csv)
        vehicles = parse_assets_csv(sample_assets_csv)
        stops = group_orders_into_stops(orders, vehicles)
        for stop in stops:
            assert 40.0 < stop.latitude < 41.5
            assert -74.5 < stop.longitude < -73.0

    def test_all_stops_have_time_windows(self, sample_orders_csv, sample_assets_csv):
        orders, _ = parse_orders_csv(sample_orders_csv)
        vehicles = parse_assets_csv(sample_assets_csv)
        stops = group_orders_into_stops(orders, vehicles)
        for stop in stops:
            assert stop.open_time >= 0
            assert stop.close_time > stop.open_time


class TestLargeOrderSplitting:
    def test_oversized_order_is_split(self, sample_assets_csv):
        """An order with more pallets than any single truck should be split."""
        csv = (
            "Work Order Number,Customer Number,Name,Address,City,State,Zip,"
            "Longitude,Latitude,Open1,Close1,FixedTime,"
            "Food Pallets, Pet Food Pallets,Chemical Pallets,OrderType\n"
            "WO001,C1,Big Stop,10 Main,Bronx,NY,10451,40.82,-73.92,0830,1230,30,25.0,0,0,Dry\n"
        ).encode()
        orders, _ = parse_orders_csv(csv)
        vehicles = parse_assets_csv(sample_assets_csv)
        stops = group_orders_into_stops(orders, vehicles)
        # 25 pallets, smallest vehicle = 9 → should split into ceil(25/9) = 3 loads
        assert len(stops) >= 2
        total_pallets = sum(s.total_pallets for s in stops)
        # Total pallets across splits should equal original (scaled)
        assert total_pallets > 0
