from __future__ import annotations

import argparse
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import struct
import tempfile
import time
import unittest
import warnings
import zlib
from pathlib import Path
from unittest import mock

from PIL import Image, ImageDraw


SCRIPT = Path(__file__).resolve().parents[1] / "prepare-reviewed-packshot.py"
SPEC = importlib.util.spec_from_file_location("prepare_reviewed_packshot", SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("could not import the reviewed packshot operator")
PACKSHOT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKSHOT)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_header(width: int, height: int) -> bytes:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        checksum = zlib.crc32(kind)
        checksum = zlib.crc32(payload, checksum) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", checksum)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IEND", b"")


class FakeInnerSession:
    def __init__(self, options: object, providers: list[str]) -> None:
        self.options = options
        self.providers = providers

    def get_session_options(self) -> object:
        return self.options

    def get_providers(self) -> list[str]:
        return self.providers


class FakeRembgSession:
    def __init__(self, options: object, providers: list[str]) -> None:
        self.inner_session = FakeInnerSession(options, providers)


class ReviewedPackshotTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.source = self.root / "source.png"
        Image.new("RGB", (24, 40), (121, 43, 87)).save(self.source, "PNG")
        self.weights = self.root / "model.onnx"
        self.weights.write_bytes(b"locked-test-model")
        self.output_root = self.root / "reviews"
        self.intake = self.root / "catalogue-intake.json"
        self.candidate_id = "exact-product-250ml"
        self.write_intake()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def write_intake(
        self,
        *,
        source_sha256: str | None = None,
        width: int = 24,
        height: int = 40,
        mime_type: str = "image/png",
        identity: dict[str, object] | None = None,
    ) -> None:
        candidate = {
            "id": self.candidate_id,
            "brand": "Exact Brand",
            "variant": "Exact Product",
            "size": "250 ml",
            "identity": identity or {"gtin": "1234567890128"},
            "asset": {
                "sourceUrl": "https://brand.example/exact-product.png",
                "sourceAssetSha256": source_sha256 or sha256(self.source),
                "sourceAssetByteSize": self.source.stat().st_size,
                "sourceAssetWidth": width,
                "sourceAssetHeight": height,
                "sourceAssetMimeType": mime_type,
            },
        }
        self.intake.write_text(json.dumps({"candidates": [candidate]}))

    def args(self, candidate_id: str | None = None) -> argparse.Namespace:
        return argparse.Namespace(
            candidate_id=candidate_id or self.candidate_id,
            source=self.source,
            intake=self.intake,
            output_root=self.output_root,
            model="locked-model",
            provider="cpu",
        )

    def fake_process(self, source: Image.Image, _model: str, _provider: str):
        output = Image.new("RGBA", (2_000, 2_000), (0, 0, 0, 0))
        draw = ImageDraw.Draw(output)
        source_rgb = source.convert("RGB").getpixel((0, 0))
        draw.rectangle((400, 200, 1_599, 1_799), fill=(*source_rgb, 255))
        metrics = {
            "inferredComponentCount": 1,
            "retainedComponentCount": 1,
            "removedComponentCount": 0,
            "rawForegroundPixelCount": 1_920_000,
            "removedForegroundPixelCount": 0,
            "removedForegroundFraction": 0.0,
            "componentReviewRequired": False,
            "sourceAlphaBounds": [0, 0, 24, 40],
            "sourceForegroundFraction": 1.0,
            "sourceEdgeContactFraction": 0.0,
            "subjectTargetSize": [1_200, 1_600],
            "subjectScale": 40.0,
            "outputAlphaBounds": [400, 200, 1_600, 1_800],
            "transparentPixelCount": 2_080_000,
            "partialAlphaPixelCount": 0,
            "opaquePixelCount": 1_920_000,
        }
        return (
            output,
            "CPUExecutionProvider",
            self.weights,
            sha256(self.weights),
            PACKSHOT.expected_session_options_contract(),
            metrics,
        )

    def fake_runtime(self) -> dict[str, object]:
        return {
            "pythonVersion": "3.12.13",
            "pythonImplementation": "CPython",
            "platform": "test-platform",
            "architecture": "test-architecture",
            "runtimeLockPath": "scripts/requirements-packshots.lock.txt",
            "runtimeLockSha256": sha256(PACKSHOT.RUNTIME_LOCK),
            "lockedDistributionCount": 30,
            "lockedDistributions": dict(sorted(PACKSHOT.locked_dependencies().items())),
            "executionProvider": "CPUExecutionProvider",
            "providerChain": ["CPUExecutionProvider"],
            "sessionOptions": PACKSHOT.expected_session_options_contract(),
        }

    def run_main(self, candidate_id: str | None = None, processor=None) -> dict[str, object]:
        stdout = io.StringIO()
        with (
            mock.patch.object(PACKSHOT, "arguments", return_value=self.args(candidate_id)),
            mock.patch.object(PACKSHOT, "validate_runtime", side_effect=self.fake_runtime),
            mock.patch.object(PACKSHOT, "process_source", side_effect=processor or self.fake_process),
            contextlib.redirect_stdout(stdout),
        ):
            self.assertEqual(PACKSHOT.main(), 0)
        return json.loads(stdout.getvalue())

    def test_complete_run_is_immutable_hashed_profiled_and_source_pixel_faithful(self) -> None:
        result = self.run_main()
        candidate_root = self.output_root / self.candidate_id
        pointer = json.loads((candidate_root / "latest.json").read_text())
        run_root = candidate_root / pointer["run"]
        audit_path = run_root / "audit.json"
        audit = json.loads(audit_path.read_text())

        self.assertEqual(pointer["auditSha256"], sha256(audit_path))
        self.assertEqual(
            audit["review"]["surfaceReviewSha256"],
            sha256(run_root / "surface-review.jpg"),
        )
        self.assertEqual(audit["artifacts"], pointer["artifacts"])
        self.assertEqual(audit["processing"]["provider"], "CPUExecutionProvider")
        self.assertEqual(
            audit["processing"]["sessionOptions"],
            PACKSHOT.expected_session_options_contract(),
        )
        self.assertEqual(audit["processing"]["runtime"], self.fake_runtime())
        self.assertFalse(audit["output"]["componentReviewRequired"])

        with Image.open(run_root / "packshot-review.png") as output:
            self.assertEqual(output.getpixel((1_000, 1_000)), (121, 43, 87, 255))
            self.assertEqual(output.getpixel((0, 0))[3], 0)
            self.assertTrue(output.info.get("icc_profile"))
        self.assertTrue(Path(result["output"]).is_file())

    def test_audit_preserves_the_discriminated_manufacturer_sku_identity(self) -> None:
        canonical_identifier = {
            "kind": "manufacturer-sku",
            "value": "DGL-SKC-005",
            "label": "SKU",
        }
        self.write_intake(identity={"canonicalIdentifier": canonical_identifier})
        self.run_main()
        candidate_root = self.output_root / self.candidate_id
        pointer = json.loads((candidate_root / "latest.json").read_text())
        audit = json.loads((candidate_root / pointer["run"] / "audit.json").read_text())

        self.assertEqual(audit["candidate"]["canonicalIdentifier"], canonical_identifier)
        self.assertIsNone(audit["candidate"]["gtin"])

    def test_failed_pointer_swap_preserves_previous_authoritative_run(self) -> None:
        self.run_main()
        latest_path = self.output_root / self.candidate_id / "latest.json"
        previous = latest_path.read_bytes()

        with (
            mock.patch.object(PACKSHOT, "arguments", return_value=self.args()),
            mock.patch.object(PACKSHOT, "validate_runtime", side_effect=self.fake_runtime),
            mock.patch.object(PACKSHOT, "process_source", side_effect=self.fake_process),
            mock.patch.object(PACKSHOT, "atomic_json", side_effect=OSError("simulated swap failure")),
            self.assertRaisesRegex(OSError, "simulated swap failure"),
        ):
            PACKSHOT.main()

        self.assertEqual(latest_path.read_bytes(), previous)
        runs = list((self.output_root / self.candidate_id / "runs").iterdir())
        self.assertEqual(len(runs), 2)
        for run in runs:
            self.assertTrue((run / "audit.json").is_file())
            self.assertTrue((run / "packshot-review.png").is_file())

    def test_candidate_path_traversal_is_rejected_before_any_output(self) -> None:
        with (
            mock.patch.object(PACKSHOT, "arguments", return_value=self.args("../escape")),
            self.assertRaisesRegex(ValueError, "candidate id"),
        ):
            PACKSHOT.main()
        self.assertFalse((self.root / "escape").exists())
        self.assertFalse(self.output_root.exists())

    def test_candidate_and_runs_symlink_aliases_are_rejected(self) -> None:
        self.output_root.mkdir()
        aliased_target = self.root / "other-candidate"
        aliased_target.mkdir()
        (self.output_root / self.candidate_id).symlink_to(aliased_target, target_is_directory=True)
        with (
            mock.patch.object(PACKSHOT, "arguments", return_value=self.args()),
            mock.patch.object(PACKSHOT, "validate_runtime", side_effect=self.fake_runtime),
            self.assertRaisesRegex(ValueError, "candidate output cannot be a symlink"),
        ):
            PACKSHOT.main()
        self.assertEqual(list(aliased_target.iterdir()), [])

        (self.output_root / self.candidate_id).unlink()
        candidate_root = self.output_root / self.candidate_id
        candidate_root.mkdir()
        escaped_runs = self.root / "escaped-runs"
        escaped_runs.mkdir()
        (candidate_root / "runs").symlink_to(escaped_runs, target_is_directory=True)
        with (
            mock.patch.object(PACKSHOT, "arguments", return_value=self.args()),
            mock.patch.object(PACKSHOT, "validate_runtime", side_effect=self.fake_runtime),
            mock.patch.object(PACKSHOT, "process_source", side_effect=self.fake_process),
            self.assertRaisesRegex(ValueError, "runs directory cannot be a symlink"),
        ):
            PACKSHOT.main()
        self.assertEqual(list(escaped_runs.iterdir()), [])

    def test_hash_mime_and_dimensions_are_fail_closed(self) -> None:
        invalid_records = [
            {"source_sha256": "0" * 64},
            {"mime_type": "image/jpeg"},
            {"width": 25},
            {"height": 41},
        ]
        for invalid in invalid_records:
            with self.subTest(invalid=invalid):
                self.write_intake(**invalid)
                with (
                    mock.patch.object(PACKSHOT, "arguments", return_value=self.args()),
                    mock.patch.object(PACKSHOT, "validate_runtime", side_effect=self.fake_runtime),
                    mock.patch.object(PACKSHOT, "process_source", side_effect=self.fake_process),
                    self.assertRaises(ValueError),
                ):
                    PACKSHOT.main()
                self.assertFalse(self.output_root.exists())

    def test_component_removal_policy_flags_or_stops_material_loss(self) -> None:
        clean = PACKSHOT.component_removal_metrics(3, 2, 10_000, 9_950)
        review = PACKSHOT.component_removal_metrics(3, 2, 10_000, 9_800)
        self.assertFalse(clean["componentReviewRequired"])
        self.assertTrue(review["componentReviewRequired"])
        with self.assertRaisesRegex(ValueError, "remove 6.00%"):
            PACKSHOT.component_removal_metrics(3, 1, 10_000, 9_400)

    def test_embedded_srgb_profile_is_hash_stable_across_clock_ticks(self) -> None:
        first = PACKSHOT.srgb_profile_bytes()
        time.sleep(1.05)
        second = PACKSHOT.srgb_profile_bytes()
        self.assertEqual(first, second)

    def test_source_is_read_once_and_identity_master_uses_the_validated_bytes(self) -> None:
        original = self.source.read_bytes()

        def mutate_path_after_read(source: Image.Image, model: str, provider: str):
            self.source.write_bytes(b"replacement-after-validated-read")
            return self.fake_process(source, model, provider)

        self.run_main(processor=mutate_path_after_read)
        pointer = json.loads((self.output_root / self.candidate_id / "latest.json").read_text())
        run_root = self.output_root / self.candidate_id / pointer["run"]
        audit = json.loads((run_root / "audit.json").read_text())
        identity = next(run_root.glob("identity-master.*"))

        self.assertEqual(identity.read_bytes(), original)
        self.assertEqual(audit["source"]["sha256"], hashlib.sha256(original).hexdigest())
        self.assertEqual(audit["artifacts"]["identityMaster"]["sha256"], sha256(identity))

    def test_oversized_header_is_rejected_before_exif_transpose_or_decode(self) -> None:
        self.source.write_bytes(png_header(6_000, 6_000))
        self.write_intake(width=6_000, height=6_000)
        with (
            mock.patch.object(PACKSHOT, "arguments", return_value=self.args()),
            mock.patch.object(PACKSHOT, "validate_runtime", side_effect=self.fake_runtime),
            mock.patch.object(PACKSHOT, "process_source") as process,
            warnings.catch_warnings(),
            self.assertRaisesRegex(ValueError, "decoded source exceeds 30 megapixels"),
        ):
            warnings.simplefilter("ignore", Image.DecompressionBombWarning)
            PACKSHOT.main()
        process.assert_not_called()
        self.assertFalse(self.output_root.exists())

    def test_animated_source_is_rejected_before_processing(self) -> None:
        first = Image.new("RGB", (24, 40), (121, 43, 87))
        second = Image.new("RGB", (24, 40), (24, 160, 220))
        first.save(
            self.source,
            "PNG",
            save_all=True,
            append_images=[second],
            duration=100,
            loop=0,
        )
        self.write_intake()
        with (
            mock.patch.object(PACKSHOT, "arguments", return_value=self.args()),
            mock.patch.object(PACKSHOT, "validate_runtime", side_effect=self.fake_runtime),
            mock.patch.object(PACKSHOT, "process_source") as process,
            self.assertRaisesRegex(ValueError, "animated or multi-frame"),
        ):
            PACKSHOT.main()
        process.assert_not_called()
        self.assertFalse(self.output_root.exists())

    def test_normalize_preserves_source_rgb_regions(self) -> None:
        import numpy as np

        source = Image.new("RGBA", (32, 32), (0, 0, 0, 7))
        draw = ImageDraw.Draw(source)
        colors = {
            "top_left": (213, 31, 75, 7),
            "top_right": (14, 157, 92, 7),
            "bottom_left": (21, 89, 221, 7),
            "bottom_right": (239, 171, 17, 7),
        }
        draw.rectangle((0, 0, 15, 15), fill=colors["top_left"])
        draw.rectangle((16, 0, 31, 15), fill=colors["top_right"])
        draw.rectangle((0, 16, 15, 31), fill=colors["bottom_left"])
        draw.rectangle((16, 16, 31, 31), fill=colors["bottom_right"])
        alpha = np.full((source.height, source.width), 255, dtype=np.uint8)

        output, metrics = PACKSHOT.normalize(source, alpha)
        left, top, right, bottom = metrics["outputAlphaBounds"]
        quarter_x = (right - left) // 4
        quarter_y = (bottom - top) // 4
        samples = {
            "top_left": output.getpixel((left + quarter_x, top + quarter_y)),
            "top_right": output.getpixel((right - quarter_x - 1, top + quarter_y)),
            "bottom_left": output.getpixel((left + quarter_x, bottom - quarter_y - 1)),
            "bottom_right": output.getpixel((right - quarter_x - 1, bottom - quarter_y - 1)),
        }
        for region, pixel in samples.items():
            self.assertEqual(pixel[:3], colors[region][:3])
            self.assertEqual(pixel[3], 255)

    def test_process_source_only_uses_inference_for_the_alpha_mask(self) -> None:
        import rembg

        source = Image.new("RGBA", (24, 40), (121, 43, 87, 255))
        mask = Image.new("L", source.size, 0)
        ImageDraw.Draw(mask).rectangle((4, 5, 19, 34), fill=255)
        sessions = []

        def create_session(_model: str, *, sess_opts: object, providers: list[str]):
            session = FakeRembgSession(sess_opts, providers)
            sessions.append(session)
            return session

        with (
            mock.patch.dict(os.environ, {"U2NET_HOME": str(self.root)}),
            mock.patch.object(rembg, "new_session", side_effect=create_session) as new_session,
            mock.patch.object(rembg, "remove", return_value=mask) as remove,
        ):
            (
                output,
                provider,
                weights,
                model_sha256,
                session_contract,
                metrics,
            ) = PACKSHOT.process_source(source, "model", "cpu")

        self.assertEqual(provider, "CPUExecutionProvider")
        self.assertEqual(weights, self.weights)
        self.assertEqual(model_sha256, sha256(self.weights))
        self.assertEqual(session_contract, PACKSHOT.expected_session_options_contract())
        self.assertEqual(output.size, (2_000, 2_000))
        self.assertEqual(metrics["inferredComponentCount"], 1)
        self.assertEqual(metrics["removedForegroundFraction"], 0.0)
        bounds = metrics["outputAlphaBounds"]
        center = ((bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2)
        self.assertEqual(output.getpixel(center)[:3], (121, 43, 87))
        new_session.assert_called_once()
        session_call = new_session.call_args
        self.assertEqual(session_call.args, ("model",))
        self.assertEqual(session_call.kwargs["providers"], ["CPUExecutionProvider"])
        session_options = session_call.kwargs["sess_opts"]
        self.assertEqual(session_options.intra_op_num_threads, 1)
        self.assertEqual(session_options.inter_op_num_threads, 1)
        self.assertEqual(session_options.execution_mode.name, "ORT_SEQUENTIAL")
        self.assertTrue(session_options.use_deterministic_compute)
        self.assertTrue(session_options.use_per_session_threads)
        self.assertEqual(len(sessions), 1)
        remove.assert_called_once_with(
            source,
            session=sessions[0],
            only_mask=True,
            post_process_mask=True,
        )

    def test_model_hash_is_bound_before_and_after_inference(self) -> None:
        import rembg

        source = Image.new("RGBA", (24, 40), (121, 43, 87, 255))
        mask = Image.new("L", source.size, 255)

        def mutate_weights_during_inference(*_args, **_kwargs):
            self.weights.write_bytes(b"changed-during-inference")
            return mask

        def create_session(_model: str, *, sess_opts: object, providers: list[str]):
            return FakeRembgSession(sess_opts, providers)

        with (
            mock.patch.dict(os.environ, {"U2NET_HOME": str(self.root)}),
            mock.patch.object(rembg, "new_session", side_effect=create_session),
            mock.patch.object(rembg, "remove", side_effect=mutate_weights_during_inference),
            self.assertRaisesRegex(ValueError, "model weights changed during inference"),
        ):
            PACKSHOT.process_source(source, "model", "cpu")

    def test_identity_master_suffix_comes_from_decoded_format(self) -> None:
        misleading = self.root / "source.jpg"
        misleading.write_bytes(self.source.read_bytes())
        self.source = misleading
        self.write_intake()

        self.run_main()
        pointer = json.loads((self.output_root / self.candidate_id / "latest.json").read_text())
        run_root = self.output_root / self.candidate_id / pointer["run"]
        self.assertTrue((run_root / "identity-master.png").is_file())
        self.assertFalse((run_root / "identity-master.jpg").exists())

    def test_non_cpu_provider_is_rejected(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "supports only the CPU provider"):
            PACKSHOT.execution_provider("coreml")

    def test_session_options_ignore_wrapper_environment_and_direct_invocation(self) -> None:
        contracts = []
        environments = (
            {},
            {"OMP_NUM_THREADS": "96", "OMP_THREAD_LIMIT": "128", "MKL_NUM_THREADS": "64"},
            {"OMP_NUM_THREADS": "1"},
        )
        for environment in environments:
            with self.subTest(environment=environment), mock.patch.dict(
                os.environ,
                environment,
                clear=True,
            ):
                options, contract = PACKSHOT.deterministic_session_options()
                self.assertEqual(options.intra_op_num_threads, 1)
                self.assertEqual(options.inter_op_num_threads, 1)
                self.assertEqual(options.execution_mode.name, "ORT_SEQUENTIAL")
                self.assertTrue(options.use_deterministic_compute)
                self.assertTrue(options.use_per_session_threads)
                contracts.append(contract)

        self.assertEqual(
            contracts,
            [PACKSHOT.expected_session_options_contract()] * len(environments),
        )

    def test_process_rejects_effective_loaded_session_drift(self) -> None:
        import onnxruntime as ort
        import rembg

        source = Image.new("RGBA", (24, 40), (121, 43, 87, 255))
        drifted = ort.SessionOptions()
        drifted.intra_op_num_threads = 8
        drifted.inter_op_num_threads = 1
        drifted.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        drifted.use_deterministic_compute = True
        drifted.use_per_session_threads = True

        def create_session(_model: str, *, sess_opts: object, providers: list[str]):
            self.assertEqual(sess_opts.intra_op_num_threads, 1)
            return FakeRembgSession(drifted, providers)

        with (
            mock.patch.dict(os.environ, {"U2NET_HOME": str(self.root)}),
            mock.patch.object(rembg, "new_session", side_effect=create_session),
            mock.patch.object(rembg, "remove") as remove,
            self.assertRaisesRegex(RuntimeError, "did not retain"),
        ):
            PACKSHOT.process_source(source, "model", "cpu")
        remove.assert_not_called()

    def test_session_option_binding_fails_closed_when_runtime_does_not_retain_it(self) -> None:
        import onnxruntime as ort

        class BrokenSessionOptions:
            intra_op_num_threads = 0
            inter_op_num_threads = 0
            execution_mode = ort.ExecutionMode.ORT_PARALLEL
            use_deterministic_compute = False
            use_per_session_threads = False

            def __setattr__(self, _name: str, _value: object) -> None:
                return None

        with (
            mock.patch.object(ort, "SessionOptions", return_value=BrokenSessionOptions()),
            self.assertRaisesRegex(RuntimeError, "did not retain"),
        ):
            PACKSHOT.deterministic_session_options()

    def test_main_rejects_session_contract_drift_before_writing_output(self) -> None:
        def drifted_process(source: Image.Image, model: str, provider: str):
            result = list(self.fake_process(source, model, provider))
            result[4] = {
                **PACKSHOT.expected_session_options_contract(),
                "intraOpNumThreads": 8,
            }
            return tuple(result)

        with (
            mock.patch.object(PACKSHOT, "arguments", return_value=self.args()),
            mock.patch.object(PACKSHOT, "validate_runtime", side_effect=self.fake_runtime),
            mock.patch.object(PACKSHOT, "process_source", side_effect=drifted_process),
            self.assertRaisesRegex(ValueError, "session options changed"),
        ):
            PACKSHOT.main()
        self.assertFalse(self.output_root.exists())

    def test_run_token_binds_the_audited_session_contract(self) -> None:
        contract = PACKSHOT.expected_session_options_contract()
        fields = {
            "candidate_id": self.candidate_id,
            "source_sha256": sha256(self.source),
            "model_sha256": sha256(self.weights),
            "provider": "CPUExecutionProvider",
            "session_options": contract,
            "output_sha256": "f" * 64,
        }
        token = PACKSHOT.review_run_token(**fields)
        drifted = PACKSHOT.review_run_token(
            **{
                **fields,
                "session_options": {**contract, "intraOpNumThreads": 8},
            }
        )

        self.assertEqual(len(token), 12)
        self.assertNotEqual(token, drifted)

    def test_lock_is_complete_hashed_and_free_of_cli_server_extras(self) -> None:
        locked = PACKSHOT.locked_dependencies()
        self.assertEqual(locked["rembg"], "2.0.77")
        self.assertIn("onnxruntime", locked)
        self.assertNotIn("fastapi", locked)
        self.assertNotIn("gradio", locked)
        self.assertNotIn("uvicorn", locked)


if __name__ == "__main__":
    unittest.main()
