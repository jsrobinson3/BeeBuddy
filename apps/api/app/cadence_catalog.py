"""Beekeeping task cadence template catalog.

Defines the standard recurring tasks that the system auto-generates for users.
Each template describes a beekeeping activity with its recurrence pattern,
default priority, and seasonal timing.

Cadences use one of two scheduling modes:
  - "recurring": Repeats every `interval_days` (e.g. inspect every 14 days).
  - "seasonal": Occurs once per year in a specific month.

In the future, templates can be filtered or adjusted by user experience level.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class CadenceCategory(StrEnum):
    RECURRING = "recurring"
    SEASONAL = "seasonal"


class CadenceSeason(StrEnum):
    SPRING = "spring"
    SUMMER = "summer"
    FALL = "fall"
    WINTER = "winter"
    YEAR_ROUND = "year_round"


@dataclass(frozen=True, slots=True)
class CadenceTemplate:
    """A single cadence template definition."""

    key: str
    title: str
    description: str
    category: CadenceCategory
    season: CadenceSeason
    priority: str  # matches TaskPriority values
    interval_days: int | None = None  # for recurring cadences
    season_month: int | None = None  # 1-12, for seasonal cadences
    season_day: int = 1  # day of month for seasonal cadences


# ---------------------------------------------------------------------------
# Catalog of standard beekeeping cadences
# ---------------------------------------------------------------------------

CADENCE_CATALOG: list[CadenceTemplate] = [
    # ── Year-round recurring ──────────────────────────────────────────────
    CadenceTemplate(
        key="regular_inspection",
        title="Regular hive inspection",
        description=(
            "Open each hive and check brood pattern, food stores, queen "
            "presence, and overall colony health."
        ),
        category=CadenceCategory.RECURRING,
        season=CadenceSeason.YEAR_ROUND,
        priority="medium",
        interval_days=14,
    ),
    CadenceTemplate(
        key="varroa_monitoring",
        title="Varroa mite monitoring",
        description=(
            "Perform a mite count using a sugar roll, alcohol wash, or "
            "sticky board to assess varroa levels."
        ),
        category=CadenceCategory.RECURRING,
        season=CadenceSeason.YEAR_ROUND,
        priority="high",
        interval_days=30,
    ),
    CadenceTemplate(
        key="equipment_check",
        title="Equipment maintenance check",
        description=(
            "Inspect hive bodies, frames, bottom boards, and covers for "
            "damage, rot, or wear. Repair or replace as needed."
        ),
        category=CadenceCategory.RECURRING,
        season=CadenceSeason.YEAR_ROUND,
        priority="low",
        interval_days=60,
    ),

    # ── Spring (March–April) ──────────────────────────────────────────────
    CadenceTemplate(
        key="spring_assessment",
        title="Spring colony assessment",
        description=(
            "Evaluate each colony after winter: check population size, food "
            "stores, brood presence, and queen status."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.SPRING,
        priority="high",
        season_month=3,
        season_day=15,
    ),
    CadenceTemplate(
        key="clean_bottom_boards",
        title="Clean or replace bottom boards",
        description=(
            "Remove debris and dead bees from bottom boards. Replace with "
            "clean boards if screened bottoms are used."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.SPRING,
        priority="medium",
        season_month=3,
        season_day=15,
    ),
    CadenceTemplate(
        key="spring_feeding",
        title="Spring feeding assessment",
        description=(
            "Check if colonies need supplemental feeding (1:1 sugar syrup "
            "or pollen patties) to stimulate buildup."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.SPRING,
        priority="high",
        season_month=3,
        season_day=1,
    ),
    CadenceTemplate(
        key="reverse_brood_boxes",
        title="Reverse brood boxes",
        description=(
            "Swap the upper and lower brood boxes to encourage the queen "
            "to move upward and reduce swarming pressure."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.SPRING,
        priority="medium",
        season_month=4,
        season_day=1,
    ),

    # ── Late spring / early summer (May–June) ─────────────────────────────
    CadenceTemplate(
        key="swarm_prevention",
        title="Swarm prevention check",
        description=(
            "Look for swarm cells, crowded brood nests, and congestion. "
            "Split strong colonies or add space as needed."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.SPRING,
        priority="high",
        season_month=5,
        season_day=1,
    ),
    CadenceTemplate(
        key="add_honey_supers",
        title="Add honey supers",
        description=(
            "When the colony is strong and nectar flow begins, add honey "
            "supers above the queen excluder."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.SUMMER,
        priority="medium",
        season_month=5,
        season_day=15,
    ),

    # ── Summer (June–August) ──────────────────────────────────────────────
    CadenceTemplate(
        key="monitor_honey_flow",
        title="Monitor honey flow and supers",
        description=(
            "Check super fill levels. Add additional supers before existing "
            "ones are fully capped to avoid swarming."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.SUMMER,
        priority="medium",
        season_month=6,
        season_day=15,
    ),
    CadenceTemplate(
        key="harvest_honey",
        title="Harvest honey",
        description=(
            "Remove fully capped honey supers. Extract, filter, and bottle "
            "honey. Return wet supers for cleanup."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.SUMMER,
        priority="medium",
        season_month=7,
        season_day=15,
    ),
    CadenceTemplate(
        key="water_source_check",
        title="Ensure water source available",
        description=(
            "Verify bees have a nearby clean water source. Set up a water "
            "station with landing spots if needed."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.SUMMER,
        priority="low",
        season_month=6,
        season_day=1,
    ),

    # ── Fall (September–October) ──────────────────────────────────────────
    CadenceTemplate(
        key="fall_varroa_treatment",
        title="Fall varroa treatment",
        description=(
            "Apply a varroa treatment (e.g. oxalic acid, Apivar, or "
            "formic acid) after the last honey harvest."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.FALL,
        priority="urgent",
        season_month=9,
        season_day=1,
    ),
    CadenceTemplate(
        key="fall_feeding",
        title="Fall feeding for winter stores",
        description=(
            "Feed 2:1 sugar syrup to colonies with insufficient winter "
            "stores. Target weight varies by region."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.FALL,
        priority="high",
        season_month=9,
        season_day=15,
    ),
    CadenceTemplate(
        key="reduce_entrance",
        title="Reduce hive entrance",
        description=(
            "Install entrance reducers to help guard bees defend against "
            "robbing and prepare for cooler weather."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.FALL,
        priority="medium",
        season_month=10,
        season_day=1,
    ),
    CadenceTemplate(
        key="winter_prep",
        title="Winter preparation",
        description=(
            "Wrap hives or install moisture quilts as needed for your "
            "climate. Ensure upper ventilation. Remove queen excluders."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.FALL,
        priority="high",
        season_month=10,
        season_day=15,
    ),

    # ── Winter (November–February) ────────────────────────────────────────
    CadenceTemplate(
        key="winter_weight_check",
        title="Check hive weight and stores",
        description=(
            "Heft or weigh hives to estimate remaining stores. Apply "
            "emergency fondant or sugar if dangerously light."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.WINTER,
        priority="high",
        season_month=12,
        season_day=15,
    ),
    CadenceTemplate(
        key="winter_ventilation",
        title="Check winter ventilation",
        description=(
            "Ensure upper ventilation is open to prevent moisture buildup "
            "inside the hive. Check for ice blocking entrances."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.WINTER,
        priority="medium",
        season_month=1,
        season_day=15,
    ),
    CadenceTemplate(
        key="winter_deadout_check",
        title="Monitor for dead-outs",
        description=(
            "Listen at the entrance or gently tap the hive to check for "
            "activity. Investigate any silent hives on warm days."
        ),
        category=CadenceCategory.SEASONAL,
        season=CadenceSeason.WINTER,
        priority="medium",
        season_month=2,
        season_day=1,
    ),
]


def get_catalog() -> list[CadenceTemplate]:
    """Return the full cadence template catalog."""
    return CADENCE_CATALOG


def get_template(key: str) -> CadenceTemplate | None:
    """Look up a single template by its unique key."""
    for t in CADENCE_CATALOG:
        if t.key == key:
            return t
    return None
