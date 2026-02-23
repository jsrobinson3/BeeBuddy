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
