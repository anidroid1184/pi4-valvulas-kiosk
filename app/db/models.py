from dataclasses import dataclass
from typing import Optional

@dataclass
class Valve:
    id: int
    valvula: str
    cantidad: Optional[int]
    ubicacion: Optional[str]
    numero_serie: Optional[str]
    ficha_tecnica: Optional[str]
    simbolo: Optional[str]
