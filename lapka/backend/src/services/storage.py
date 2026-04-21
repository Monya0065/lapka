import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional
import uuid


class StorageAdapter(ABC):
    """Abstract storage adapter. S3-ready interface."""

    @abstractmethod
    async def save(self, data: bytes, key: str, content_type: str) -> str:
        """Save bytes to key. Returns the stored key/path/URL."""
        raise NotImplementedError

    @abstractmethod
    async def read(self, key: str) -> bytes:
        """Read bytes from key."""
        raise NotImplementedError

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete key."""
        raise NotImplementedError

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if key exists."""
        raise NotImplementedError

    @abstractmethod
    def public_url(self, key: str) -> str:
        """Return a public/readable URL for key, or signed URL for S3."""
        raise NotImplementedError


class LocalStorageAdapter(StorageAdapter):
    """Local filesystem storage. Dev / fallback."""

    def __init__(self, root: str | Path = "storage"):
        self._root = Path(root).resolve()

    def _resolve(self, key: str) -> Path:
        rel = key.strip("/").lstrip("/")
        if ".." in rel:
            raise ValueError(f"Path traversal attempt: {key}")
        return (self._root / rel).resolve()

    def _guard(self, path: Path) -> None:
        if not str(path).startswith(str(self._root)):
            raise ValueError(f"Path outside storage root: {path}")

    async def save(self, data: bytes, key: str, content_type: str = "application/octet-stream") -> str:
        path = self._resolve(key)
        self._guard(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    async def read(self, key: str) -> bytes:
        path = self._resolve(key)
        self._guard(path)
        if not path.is_file():
            raise FileNotFoundError(f"File not found: {key}")
        return path.read_bytes()

    async def delete(self, key: str) -> None:
        path = self._resolve(key)
        self._guard(path)
        if path.is_file():
            path.unlink()

    async def exists(self, key: str) -> bool:
        try:
            path = self._resolve(key)
            self._guard(path)
            return path.is_file()
        except (ValueError, FileNotFoundError):
            return False

    def public_url(self, key: str) -> str:
        return f"/storage/{key.strip('/')}"


class S3StorageAdapter(StorageAdapter):
    """S3-compatible storage (AWS S3, MinIO, etc.)."""

    def __init__(
        self,
        bucket: str,
        endpoint: str | None = None,
        region: str = "eu-north-1",
        access_key: str | None = None,
        secret_key: str | None = None,
        public_base: str | None = None,
    ):
        self._bucket = bucket
        self._region = region
        self._endpoint = endpoint or f"https://{bucket}.s3.{region}.amazonaws.com"
        self._access_key = access_key or os.environ.get("AWS_ACCESS_KEY_ID", "")
        self._secret_key = secret_key or os.environ.get("AWS_SECRET_ACCESS_KEY", "")
        self._public_base = public_base or f"https://{bucket}.s3.{region}.amazonaws.com/{bucket}"
        self._client: Optional[object] = None

    def _get_client(self):
        if self._client:
            return self._client
        try:
            import boto3

            self._client = boto3.client(
                "s3",
                region_name=self._region,
                endpoint_url=self._endpoint if self._endpoint != f"https://{self._bucket}.s3.{self._region}.amazonaws.com" else None,
                aws_access_key_id=self._access_key,
                aws_secret_access_key=self._secret_key,
            )
            return self._client
        except ImportError:
            raise ImportError("boto3 is required for S3 storage. Install: pip install boto3")

    async def save(self, data: bytes, key: str, content_type: str = "application/octet-stream") -> str:
        client = self._get_client()
        client.put_object(Bucket=self._bucket, Key=key, Body=data, ContentType=content_type)
        return key

    async def read(self, key: str) -> bytes:
        client = self._get_client()
        response = client.get_object(Bucket=self._bucket, Key=key)
        return response["Body"].read()

    async def delete(self, key: str) -> None:
        client = self._get_client()
        client.delete_object(Bucket=self._bucket, Key=key)

    async def exists(self, key: str) -> bool:
        client = self._get_client()
        try:
            client.head_object(Bucket=self._bucket, Key=key)
            return True
        except client.exceptions.ClientError:
            return False

    def public_url(self, key: str) -> str:
        return f"{self._public_base}/{key}"


def get_storage_adapter() -> StorageAdapter:
    """Factory: pick S3 if env configured, else local."""
    if os.environ.get("S3_BUCKET"):
        return S3StorageAdapter(
            bucket=os.environ["S3_BUCKET"],
            endpoint=os.environ.get("S3_ENDPOINT"),
            region=os.environ.get("S3_REGION", "eu-north-1"),
            access_key=os.environ.get("AWS_ACCESS_KEY_ID"),
            secret_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
            public_base=os.environ.get("S3_PUBLIC_BASE"),
        )
    return LocalStorageAdapter()


async def save_document_file(data: bytes, pet_id: uuid.UUID, filename: str, content_type: str) -> tuple[str, str]:
    """
    Save a document file. Returns (file_ref, url).
    file_ref is stored in DB. url is for immediate display.
    """
    adapter = get_storage_adapter()
    ext = os.path.splitext(filename)[1].lower()
    key = f"documents/{pet_id}/{uuid.uuid4()}{ext}"
    await adapter.save(data, key, content_type)
    return key, adapter.public_url(key)


async def read_document_file(file_ref: str) -> bytes:
    """Read document bytes from storage."""
    adapter = get_storage_adapter()
    return await adapter.read(file_ref)


async def delete_document_file(file_ref: str) -> None:
    """Delete document from storage."""
    adapter = get_storage_adapter()
    await adapter.delete(file_ref)