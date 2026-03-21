"""Tests for the safety guard — chemical, dosage, PPE, withdrawal checks."""

from app.services.guardrails.safety import check_safety


class TestBannedSubstances:
    """Banned substances should be flagged unless warned against."""

    def test_recommending_banned_substance_flagged(self):
        response = "You could try using chlorfenvinphos to control varroa mites."
        result = check_safety(response)
        assert not result.passed
        assert result.has_high_severity
        assert any(f.category == "banned_substance" for f in result.flags)

    def test_warning_against_banned_substance_ok(self):
        response = "Never use chlorfenvinphos — it's banned and toxic to bees."
        result = check_safety(response)
        banned_flags = [f for f in result.flags if f.category == "banned_substance"]
        assert not banned_flags

    def test_multiple_banned_substances(self):
        response = "Some old-timers used dichlorvos and naphthalene, both work well."
        result = check_safety(response)
        banned = [f for f in result.flags if f.category == "banned_substance"]
        assert len(banned) >= 2

    def test_neonicotinoid_flagged(self):
        response = "Apply imidacloprid around the hive entrance for ant control."
        result = check_safety(response)
        assert any(f.substance == "imidacloprid" for f in result.flags)


class TestPPEWarnings:
    """Chemical treatment mentions should include PPE warnings."""

    def test_oxalic_without_ppe_flagged(self):
        response = "Dribble oxalic acid solution between the frames in late fall."
        result = check_safety(response)
        ppe_flags = [f for f in result.flags if f.category == "missing_ppe"]
        assert ppe_flags
        assert ppe_flags[0].substance == "oxalic acid"

    def test_oxalic_with_ppe_ok(self):
        response = (
            "Dribble oxalic acid solution between the frames. "
            "Wear chemical-resistant gloves and safety goggles."
        )
        result = check_safety(response)
        ppe_flags = [f for f in result.flags if f.category == "missing_ppe"]
        assert not ppe_flags

    def test_formic_without_ppe_flagged(self):
        response = "Apply formic acid pads on top of the brood frames."
        result = check_safety(response)
        ppe_flags = [f for f in result.flags if f.category == "missing_ppe"]
        assert ppe_flags

    def test_apivar_without_ppe_flagged(self):
        response = "Hang two apivar strips per brood box for 42 days."
        result = check_safety(response)
        ppe_flags = [f for f in result.flags if f.category == "missing_ppe"]
        assert ppe_flags

    def test_general_ppe_mention_covers_all(self):
        response = (
            "Apply formic acid pads and apivar strips. "
            "Always wear protective equipment including gloves."
        )
        result = check_safety(response)
        ppe_flags = [f for f in result.flags if f.category == "missing_ppe"]
        assert not ppe_flags


class TestDosage:
    """Specific dosage without label reference should be flagged."""

    def test_dosage_without_label_flagged(self):
        response = "Mix 3.2g of oxalic acid per liter of sugar syrup."
        result = check_safety(response)
        dosage_flags = [f for f in result.flags if f.category == "dosage"]
        assert dosage_flags

    def test_dosage_with_label_reference_ok(self):
        response = (
            "Mix oxalic acid per the product label directions. "
            "A common ratio is 3.2g per liter."
        )
        result = check_safety(response)
        dosage_flags = [f for f in result.flags if f.category == "dosage"]
        assert not dosage_flags

    def test_no_dosage_no_flag(self):
        response = "Oxalic acid is effective against varroa when used properly."
        result = check_safety(response)
        dosage_flags = [f for f in result.flags if f.category == "dosage"]
        assert not dosage_flags


class TestWithdrawal:
    """Treatment advice should mention withdrawal periods."""

    def test_treatment_without_withdrawal_flagged(self):
        response = "Apply oxalic acid by vaporizing it into the hive entrance."
        result = check_safety(response)
        withdrawal_flags = [f for f in result.flags if f.category == "withdrawal"]
        assert withdrawal_flags

    def test_treatment_with_withdrawal_ok(self):
        response = (
            "Apply oxalic acid by vaporizing into the hive entrance. "
            "Remove honey supers before treatment and follow the label "
            "for the withdrawal period before adding supers back."
        )
        result = check_safety(response)
        withdrawal_flags = [f for f in result.flags if f.category == "withdrawal"]
        assert not withdrawal_flags

    def test_non_treatment_response_no_flag(self):
        response = "Varroa mites are the biggest threat to honey bee colonies worldwide."
        result = check_safety(response)
        withdrawal_flags = [f for f in result.flags if f.category == "withdrawal"]
        assert not withdrawal_flags


class TestDisclaimers:
    """Check that disclaimer text is set appropriately."""

    def test_high_severity_gets_banned_disclaimer(self):
        response = "Try chlorfenvinphos for quick mite knockdown."
        result = check_safety(response)
        assert result.disclaimer_needed
        text = result.disclaimer_text.lower()
        assert "banned" in text or "restricted" in text

    def test_medium_severity_gets_safety_disclaimer(self):
        response = "Dribble oxalic acid solution between the frames."
        result = check_safety(response)
        assert result.disclaimer_needed
        assert "label" in result.disclaimer_text.lower()

    def test_clean_response_no_disclaimer(self):
        response = "Bees need about 60 pounds of honey to survive winter."
        result = check_safety(response)
        assert result.passed
        assert not result.disclaimer_needed
        assert result.disclaimer_text == ""
