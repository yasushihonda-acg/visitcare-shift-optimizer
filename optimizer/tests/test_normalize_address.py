"""住所正規化のテスト — TS版 (web/src/lib/normalize-address.ts) と同一ケース"""

from optimizer.data.normalize_address import normalize_address


class TestNormalizeAddress:
    def test_fullwidth_ascii_to_halfwidth(self) -> None:
        assert normalize_address("東京都新宿区１−２−３") == "東京都新宿区1-2-3"

    def test_halfwidth_katakana_to_fullwidth(self) -> None:
        assert normalize_address("ｶﾅ町") == "カナ町"

    def test_fullwidth_space_to_halfwidth(self) -> None:
        assert normalize_address("東京都\u3000新宿区") == "東京都 新宿区"

    def test_collapse_multiple_spaces(self) -> None:
        assert normalize_address("東京都   新宿区") == "東京都 新宿区"

    def test_trim_whitespace(self) -> None:
        assert normalize_address("  東京都新宿区  ") == "東京都新宿区"

    def test_unify_hyphens(self) -> None:
        assert normalize_address("1‐2") == "1-2"
        assert normalize_address("1―2") == "1-2"
        assert normalize_address("1ー2") == "1-2"
        assert normalize_address("1–2") == "1-2"
        assert normalize_address("1—2") == "1-2"
        assert normalize_address("1﹣2") == "1-2"
        assert normalize_address("1－2") == "1-2"
        # U+2212 MINUS SIGN
        assert normalize_address("1\u22122") == "1-2"

    def test_combined_normalization(self) -> None:
        assert normalize_address("\u3000東京都\u3000新宿区１ー２ー３\u3000") == "東京都 新宿区1-2-3"

    def test_empty_string(self) -> None:
        assert normalize_address("") == ""

    def test_already_normalized(self) -> None:
        assert normalize_address("東京都新宿区1-2-3") == "東京都新宿区1-2-3"

    def test_cross_platform_consistency(self) -> None:
        """TS版と同一の期待値（クロスプラットフォーム一貫性）"""
        cases = [
            ("大阪市北区１丁目２−３", "大阪市北区1丁目2-3"),
            ("ﾏﾝｼｮﾝ名\u3000１０２号", "マンション名 102号"),
            ("渋谷区神南１ー１ー１", "渋谷区神南1-1-1"),
        ]
        for input_addr, expected in cases:
            assert normalize_address(input_addr) == expected
