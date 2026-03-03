from io import BytesIO
from pathlib import Path

import pytest
from fastapi import UploadFile

import app.providers.storage as storage_module
from app.providers.storage import LocalFileStorage, build_storage_provider


def test_local_file_storage_round_trip(tmp_path):
    storage = LocalFileStorage(str(tmp_path))
    upload = UploadFile(file=BytesIO(b"hello world"), filename="sample.txt", size=11)

    stored = storage.save_book_file(upload)
    saved_path = tmp_path / stored.path

    assert stored.original_file_name == "sample.txt"
    assert stored.file_size == 11
    assert saved_path.exists()

    with storage.open_book_file(stored.path) as file_handle:
        assert file_handle.read() == b"hello world"

    storage.delete_book_file(stored.path)
    assert not saved_path.exists()


def test_build_storage_provider_rejects_unknown_provider(monkeypatch, tmp_path):
    monkeypatch.setattr(storage_module.settings, "STORAGE_PROVIDER", "unsupported")
    monkeypatch.setattr(storage_module.settings, "BOOK_STORAGE_DIR", str(tmp_path / "books"))

    with pytest.raises(RuntimeError, match="Unsupported storage provider"):
        build_storage_provider()
