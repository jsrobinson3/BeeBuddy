"""Unit tests for the cadence catalog module.

These tests run without any database or API — they exercise pure Python logic.
"""

from datetime import date

from app.cadence_catalog import (
    CADENCE_CATALOG,
    CadenceCategory,
    CadenceSeason,
    CadenceTemplate,
    get_catalog,
    get_template,
)


class TestCatalogIntegrity:
    """Verify the catalog data is well-formed."""

    def test_catalog_is_not_empty(self):
        assert len(CADENCE_CATALOG) > 0

    def test_all_keys_unique(self):
        keys = [t.key for t in CADENCE_CATALOG]
        assert len(keys) == len(set(keys)), "Duplicate keys found"

    def test_recurring_have_interval_days(self):
        for t in CADENCE_CATALOG:
            if t.category == CadenceCategory.RECURRING:
                assert t.interval_days is not None and t.interval_days > 0, (
                    f"Recurring cadence {t.key} missing interval_days"
                )

    def test_seasonal_have_season_month(self):
        for t in CADENCE_CATALOG:
            if t.category == CadenceCategory.SEASONAL:
                assert t.season_month is not None, (
                    f"Seasonal cadence {t.key} missing season_month"
                )
                assert 1 <= t.season_month <= 12, (
                    f"Seasonal cadence {t.key} has invalid month {t.season_month}"
                )

    def test_seasonal_have_valid_day(self):
        for t in CADENCE_CATALOG:
            if t.category == CadenceCategory.SEASONAL:
                assert 1 <= t.season_day <= 28, (
                    f"Seasonal cadence {t.key} has day {t.season_day} (keep <= 28 for safety)"
                )

    def test_all_priorities_valid(self):
        valid = {"low", "medium", "high", "urgent"}
        for t in CADENCE_CATALOG:
            assert t.priority in valid, f"Cadence {t.key} has invalid priority {t.priority}"

    def test_all_categories_valid(self):
        for t in CADENCE_CATALOG:
            assert t.category in CadenceCategory.__members__.values()

    def test_all_seasons_valid(self):
        for t in CADENCE_CATALOG:
            assert t.season in CadenceSeason.__members__.values()

    def test_templates_are_frozen(self):
        """CadenceTemplate is a frozen dataclass — immutability."""
        t = CADENCE_CATALOG[0]
        try:
            t.key = "hacked"  # type: ignore[misc]
            assert False, "Should have raised"
        except AttributeError:
            pass

    def test_has_all_four_seasons(self):
        seasons = {t.season for t in CADENCE_CATALOG}
        assert CadenceSeason.SPRING in seasons
        assert CadenceSeason.SUMMER in seasons
        assert CadenceSeason.FALL in seasons
        assert CadenceSeason.WINTER in seasons


class TestGetCatalog:
    def test_returns_full_list(self):
        result = get_catalog()
        assert result is CADENCE_CATALOG

    def test_length_matches(self):
        assert len(get_catalog()) == len(CADENCE_CATALOG)


class TestGetTemplate:
    def test_known_key(self):
        tpl = get_template("regular_inspection")
        assert tpl is not None
        assert tpl.key == "regular_inspection"
        assert tpl.category == CadenceCategory.RECURRING

    def test_unknown_key_returns_none(self):
        assert get_template("nonexistent_cadence") is None

    def test_all_catalog_keys_resolvable(self):
        for t in CADENCE_CATALOG:
            assert get_template(t.key) is t


class TestCadenceServiceHelpers:
    """Test _compute_next_due from the service module."""

    def test_recurring_next_due(self):
        from app.services.cadence_service import _compute_next_due

        start = date(2026, 1, 1)
        result = _compute_next_due("regular_inspection", from_date=start)
        # regular_inspection has interval_days=14
        assert result == date(2026, 1, 15)

    def test_recurring_varroa_monitoring(self):
        from app.services.cadence_service import _compute_next_due

        start = date(2026, 3, 1)
        result = _compute_next_due("varroa_monitoring", from_date=start)
        # varroa_monitoring has interval_days=30
        assert result == date(2026, 3, 31)

    def test_seasonal_future_month(self):
        from app.services.cadence_service import _compute_next_due

        # spring_assessment is month=3, day=15
        start = date(2026, 1, 1)
        result = _compute_next_due("spring_assessment", from_date=start)
        assert result == date(2026, 3, 15)

    def test_seasonal_past_month_rolls_to_next_year(self):
        from app.services.cadence_service import _compute_next_due

        # spring_assessment is month=3, day=15 — if we're in April it wraps
        start = date(2026, 4, 1)
        result = _compute_next_due("spring_assessment", from_date=start)
        assert result == date(2027, 3, 15)

    def test_seasonal_same_day_rolls_to_next_year(self):
        from app.services.cadence_service import _compute_next_due

        # If today IS the seasonal date, it should roll forward
        start = date(2026, 3, 15)
        result = _compute_next_due("spring_assessment", from_date=start)
        assert result == date(2027, 3, 15)

    def test_unknown_key_returns_none(self):
        from app.services.cadence_service import _compute_next_due

        result = _compute_next_due("totally_fake", from_date=date(2026, 1, 1))
        assert result is None

    def test_default_from_date_is_today(self):
        from app.services.cadence_service import _compute_next_due

        result = _compute_next_due("regular_inspection")
        assert result is not None
        assert result > date.today()


class TestHemisphereHelpers:
    """Test hemisphere detection and month offset logic."""

    def test_detect_hemisphere_positive_latitude(self):
        from app.services.cadence_service import detect_hemisphere

        assert detect_hemisphere(45.0) == "north"

    def test_detect_hemisphere_negative_latitude(self):
        from app.services.cadence_service import detect_hemisphere

        assert detect_hemisphere(-33.8) == "south"

    def test_detect_hemisphere_zero_is_north(self):
        from app.services.cadence_service import detect_hemisphere

        assert detect_hemisphere(0.0) == "north"

    def test_detect_hemisphere_none_defaults_north(self):
        from app.services.cadence_service import detect_hemisphere

        assert detect_hemisphere(None) == "north"

    def test_offset_month_north_no_change(self):
        from app.services.cadence_service import _offset_month

        assert _offset_month(3, "north") == 3
        assert _offset_month(9, "north") == 9

    def test_offset_month_south_shifts_by_six(self):
        from app.services.cadence_service import _offset_month

        # March(3) -> September(9)
        assert _offset_month(3, "south") == 9
        # September(9) -> March(3)
        assert _offset_month(9, "south") == 3
        # January(1) -> July(7)
        assert _offset_month(1, "south") == 7
        # July(7) -> January(1)
        assert _offset_month(7, "south") == 1
        # June(6) -> December(12)
        assert _offset_month(6, "south") == 12
        # December(12) -> June(6)
        assert _offset_month(12, "south") == 6

    def test_offset_month_all_twelve_months_south(self):
        from app.services.cadence_service import _offset_month

        expected = {1: 7, 2: 8, 3: 9, 4: 10, 5: 11, 6: 12,
                    7: 1, 8: 2, 9: 3, 10: 4, 11: 5, 12: 6}
        for month, exp in expected.items():
            assert _offset_month(month, "south") == exp, f"Month {month}"


class TestSouthernHemisphereScheduling:
    """Test that _compute_next_due correctly offsets for southern hemisphere."""

    def test_spring_assessment_shifted_to_september(self):
        from app.services.cadence_service import _compute_next_due

        # spring_assessment is month=3, day=15 in the catalog
        # For southern hemisphere: month becomes 9
        start = date(2026, 1, 1)
        result = _compute_next_due("spring_assessment", from_date=start, hemisphere="south")
        assert result == date(2026, 9, 15)

    def test_fall_varroa_treatment_shifted_to_march(self):
        from app.services.cadence_service import _compute_next_due

        # fall_varroa_treatment is month=9, day=1
        # For southern hemisphere: month becomes 3
        start = date(2026, 1, 1)
        result = _compute_next_due("fall_varroa_treatment", from_date=start, hemisphere="south")
        assert result == date(2026, 3, 1)

    def test_winter_weight_check_shifted_to_june(self):
        from app.services.cadence_service import _compute_next_due

        # winter_weight_check is month=12, day=15
        # For southern hemisphere: month becomes 6
        start = date(2026, 1, 1)
        result = _compute_next_due("winter_weight_check", from_date=start, hemisphere="south")
        assert result == date(2026, 6, 15)

    def test_recurring_not_affected_by_hemisphere(self):
        from app.services.cadence_service import _compute_next_due

        start = date(2026, 1, 1)
        north = _compute_next_due("regular_inspection", from_date=start, hemisphere="north")
        south = _compute_next_due("regular_inspection", from_date=start, hemisphere="south")
        assert north == south == date(2026, 1, 15)

    def test_southern_past_month_rolls_to_next_year(self):
        from app.services.cadence_service import _compute_next_due

        # fall_varroa_treatment: south hemisphere month=3, day=1
        # If we're already in April, it should roll to next year March
        start = date(2026, 4, 1)
        result = _compute_next_due("fall_varroa_treatment", from_date=start, hemisphere="south")
        assert result == date(2027, 3, 1)

    def test_north_and_south_differ_for_seasonal(self):
        from app.services.cadence_service import _compute_next_due

        start = date(2026, 1, 1)
        north = _compute_next_due("spring_assessment", from_date=start, hemisphere="north")
        south = _compute_next_due("spring_assessment", from_date=start, hemisphere="south")
        assert north != south
        assert north == date(2026, 3, 15)
        assert south == date(2026, 9, 15)


class TestCustomCadenceOverrides:
    """Test user-customizable interval and season overrides."""

    def test_custom_interval_overrides_catalog(self):
        from app.services.cadence_service import _compute_next_due

        # regular_inspection default is 14 days; override to 10
        start = date(2026, 1, 1)
        result = _compute_next_due(
            "regular_inspection", from_date=start, custom_interval_days=10,
        )
        assert result == date(2026, 1, 11)

    def test_custom_interval_none_falls_back_to_catalog(self):
        from app.services.cadence_service import _compute_next_due

        start = date(2026, 1, 1)
        result = _compute_next_due(
            "regular_inspection", from_date=start, custom_interval_days=None,
        )
        # Falls back to catalog default of 14 days
        assert result == date(2026, 1, 15)

    def test_custom_season_month_overrides_catalog(self):
        from app.services.cadence_service import _compute_next_due

        # spring_assessment default is month=3, day=15
        # Override to month=4 (April assessment instead of March)
        start = date(2026, 1, 1)
        result = _compute_next_due(
            "spring_assessment", from_date=start, custom_season_month=4,
        )
        assert result == date(2026, 4, 15)

    def test_custom_season_day_overrides_catalog(self):
        from app.services.cadence_service import _compute_next_due

        # spring_assessment default is month=3, day=15
        # Override just the day to 1
        start = date(2026, 1, 1)
        result = _compute_next_due(
            "spring_assessment", from_date=start, custom_season_day=1,
        )
        assert result == date(2026, 3, 1)

    def test_custom_season_month_and_day(self):
        from app.services.cadence_service import _compute_next_due

        start = date(2026, 1, 1)
        result = _compute_next_due(
            "spring_assessment", from_date=start,
            custom_season_month=4, custom_season_day=20,
        )
        assert result == date(2026, 4, 20)

    def test_custom_season_with_southern_hemisphere(self):
        from app.services.cadence_service import _compute_next_due

        # Custom month=4 for southern hemisphere -> offset to month=10
        start = date(2026, 1, 1)
        result = _compute_next_due(
            "spring_assessment", from_date=start,
            hemisphere="south", custom_season_month=4,
        )
        assert result == date(2026, 10, 15)

    def test_custom_interval_very_short(self):
        from app.services.cadence_service import _compute_next_due

        # Beekeeper with many hives may inspect every 7 days
        start = date(2026, 6, 1)
        result = _compute_next_due(
            "regular_inspection", from_date=start, custom_interval_days=7,
        )
        assert result == date(2026, 6, 8)

    def test_custom_interval_very_long(self):
        from app.services.cadence_service import _compute_next_due

        # Hobby beekeeper with one hive may inspect monthly
        start = date(2026, 6, 1)
        result = _compute_next_due(
            "regular_inspection", from_date=start, custom_interval_days=30,
        )
        assert result == date(2026, 7, 1)
