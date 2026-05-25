import enum


class JobStatus(str, enum.Enum):
    pending = "pending"
    translating = "translating"
    processing = "processing"
    ready = "ready"
    partial = "partial"
    failed = "failed"


class AudioStatus(str, enum.Enum):
    pending = "pending"
    generating = "generating"
    complete = "complete"
    failed = "failed"
