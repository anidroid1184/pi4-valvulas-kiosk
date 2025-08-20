from dataclasses import dataclass
from typing import Optional

@dataclass
class Valve:
    id: int
    nombre: str
    uso: Optional[str]
    ubicacion: Optional[str]
    qr_code: Optional[str]
    foto: Optional[str]
