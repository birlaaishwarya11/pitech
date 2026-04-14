"""
Unit tests for the special instructions parser.

Test cases are written from the USER's perspective:
- A dispatcher types instructions in a text box
- The system should correctly parse skip, lock, priority, window, and note directives
- Typos and bad formatting should be caught as errors, not crash the system
"""

from app.services.instructions_parser import parse_instructions


class TestSkipDirective:
    def test_skip_single_wo(self):
        result = parse_instructions("skip: WO#977187")
        assert "977187" in result["skip_wos"]

    def test_skip_without_hash(self):
        """User might forget the # sign."""
        result = parse_instructions("skip: WO977187")
        assert "977187" in result["skip_wos"]

    def test_skip_multiple_lines(self):
        text = "skip: WO#100\nskip: WO#200\nskip: WO#300"
        result = parse_instructions(text)
        assert result["skip_wos"] == {"100", "200", "300"}

    def test_skip_case_insensitive(self):
        result = parse_instructions("Skip: WO#555")
        assert "555" in result["skip_wos"]


class TestLockDirective:
    def test_lock_with_arrow(self):
        result = parse_instructions("lock: Salt & Sea Mission → truck=FB-1")
        assert "FB-1" in result["lock_stops"].values()

    def test_lock_with_ascii_arrow(self):
        result = parse_instructions("lock: My Stop -> truck=FB-2")
        assert "FB-2" in result["lock_stops"].values()

    def test_lock_name_stored_lowercase(self):
        result = parse_instructions("lock: UPPER CASE NAME → truck=FB-3")
        keys = list(result["lock_stops"].keys())
        assert all(k == k.lower() for k in keys)

    def test_lock_multiple(self):
        text = "lock: Stop A → truck=FB-1\nlock: Stop B → truck=FB-2"
        result = parse_instructions(text)
        assert len(result["lock_stops"]) == 2


class TestPriorityDirective:
    def test_priority_single(self):
        result = parse_instructions("priority: MUNA Social Service")
        assert len(result["priority_stops"]) == 1

    def test_priority_stored_lowercase(self):
        result = parse_instructions("priority: ABC Center")
        assert result["priority_stops"][0] == result["priority_stops"][0].lower()

    def test_priority_multiple(self):
        text = "priority: Stop A\npriority: Stop B"
        result = parse_instructions(text)
        assert len(result["priority_stops"]) == 2


class TestWindowDirective:
    def test_window_standard_format(self):
        result = parse_instructions("window: WO#976054 → 08:30-10:00")
        assert "976054" in result["window_overrides"]
        open_t, close_t = result["window_overrides"]["976054"]
        assert open_t == 8 * 60 + 30  # 510 minutes
        assert close_t == 10 * 60  # 600 minutes

    def test_window_with_ascii_arrow(self):
        result = parse_instructions("window: WO#123 -> 09:00-12:00")
        assert "123" in result["window_overrides"]

    def test_window_afternoon(self):
        result = parse_instructions("window: WO#456 → 13:00-16:30")
        open_t, close_t = result["window_overrides"]["456"]
        assert open_t == 13 * 60  # 780
        assert close_t == 16 * 60 + 30  # 990


class TestNoteDirective:
    def test_note_standard(self):
        result = parse_instructions("note: WO#976055 → call 30min ahead")
        assert "976055" in result["notes"]
        assert "call 30min ahead" in result["notes"]["976055"]

    def test_note_preserves_text(self):
        result = parse_instructions("note: WO#100 → Use back entrance, ring bell")
        assert "Use back entrance, ring bell" in result["notes"]["100"]


class TestEdgeCases:
    def test_empty_input(self):
        result = parse_instructions("")
        assert result["skip_wos"] == set()
        assert result["lock_stops"] == {}
        assert result["priority_stops"] == []
        assert result["window_overrides"] == {}
        assert result["notes"] == {}
        assert result["errors"] == []

    def test_none_input(self):
        result = parse_instructions(None)
        assert result["errors"] == []

    def test_comment_lines_ignored(self):
        result = parse_instructions("# This is a comment\nskip: WO#999")
        assert "999" in result["skip_wos"]
        assert len(result["errors"]) == 0

    def test_blank_lines_ignored(self):
        result = parse_instructions("\n\n\nskip: WO#111\n\n")
        assert "111" in result["skip_wos"]

    def test_unparseable_lines_become_errors(self):
        result = parse_instructions("this is nonsense gibberish")
        assert len(result["errors"]) > 0

    def test_mixed_directives(self):
        text = (
            "skip: WO#100\n"
            "lock: Stop X → truck=FB-5\n"
            "priority: Important Place\n"
            "window: WO#200 → 09:00-11:00\n"
            "note: WO#300 → fragile items\n"
        )
        result = parse_instructions(text)
        assert "100" in result["skip_wos"]
        assert len(result["lock_stops"]) == 1
        assert len(result["priority_stops"]) == 1
        assert "200" in result["window_overrides"]
        assert "300" in result["notes"]
        assert result["errors"] == []
