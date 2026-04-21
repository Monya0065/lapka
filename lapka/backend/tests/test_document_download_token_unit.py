"""Unit tests for HMAC document file download links."""

from __future__ import annotations

from unittest import mock

from src.services.document_download_token import sign_document_file_link, verify_document_file_link


def test_sign_verify_roundtrip() -> None:
    exp = 9_999_999_999
    sig = sign_document_file_link(doc_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", expires_at_unix=exp)
    assert verify_document_file_link(
        doc_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        expires_at_unix=exp,
        signature=sig,
    )
    assert not verify_document_file_link(
        doc_id="ffffffff-ffff-ffff-ffff-ffffffffffff",
        expires_at_unix=exp,
        signature=sig,
    )


def test_wrong_signature_rejected() -> None:
    exp = 9_999_999_999
    sig = sign_document_file_link(doc_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", expires_at_unix=exp)
    assert not verify_document_file_link(
        doc_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        expires_at_unix=exp,
        signature=sig + "0",
    )


def test_expired_link_rejected() -> None:
    exp = 1_000
    sig = sign_document_file_link(doc_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", expires_at_unix=exp)
    with mock.patch("src.services.document_download_token.time.time", return_value=2_000):
        assert not verify_document_file_link(
            doc_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            expires_at_unix=exp,
            signature=sig,
        )
