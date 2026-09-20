from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import TextIO


_LOGGER_NAME = "toolregistry"
_DEFAULT_FORMAT = (
    "%(asctime)s %(levelname)s %(name)s %(message)s "
    "provider=%(provider)s operation=%(operation)s model=%(model)s "
    "duration_ms=%(duration_ms)s error_category=%(error_category)s"
)


class _ContextDefaults(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        for name in (
            "provider",
            "operation",
            "model",
            "duration_ms",
            "error_category",
        ):
            value = getattr(record, name, None)
            if value is None:
                setattr(record, name, "-")
        return True


def configure_logging(
    *,
    level: int | str | None = None,
    log_file: str | os.PathLike[str] | None = None,
    stream: TextIO | None = None,
) -> logging.Logger:
    """Configure toolregistry call logs without exposing API keys or payloads."""
    logger = logging.getLogger(_LOGGER_NAME)
    logger.setLevel(level or os.getenv("TOOLREGISTRY_LOG_LEVEL", "INFO"))
    logger.propagate = False

    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        handler.close()

    for name in list(logging.Logger.manager.loggerDict):
        if name.startswith(f"{_LOGGER_NAME}."):
            child = logging.getLogger(name)
            for handler in list(child.handlers):
                child.removeHandler(handler)
                handler.close()
            child.propagate = True
            child.setLevel(logger.level)

    formatter = logging.Formatter(_DEFAULT_FORMAT)
    destination = stream or __import__("sys").stderr
    console_handler = logging.StreamHandler(destination)
    console_handler.setFormatter(formatter)
    console_handler.addFilter(_ContextDefaults())
    logger.addHandler(console_handler)

    file_name = log_file or os.getenv("TOOLREGISTRY_LOG_FILE")
    if file_name:
        path = Path(file_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        file_handler.addFilter(_ContextDefaults())
        logger.addHandler(file_handler)

    return logger