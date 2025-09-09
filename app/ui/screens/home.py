import tkinter as tk
from tkinter import ttk

class HomeScreen(ttk.Frame):
    """Simple home screen with navigation placeholders."""
    def __init__(self, parent, on_navigate):
        super().__init__(parent)
        self.on_navigate = on_navigate

        title = ttk.Label(self, text="Valve Finder", font=("Arial", 24))
        title.pack(pady=20)

        btn_list = ttk.Button(self, text="Buscar manualmente", command=lambda: self.on_navigate('list'))
        btn_list.pack(pady=10)

        btn_qr = ttk.Button(self, text="Escanear QR (Simulado)", command=lambda: self.on_navigate('qr_scan'))
        btn_qr.pack(pady=10)

        btn_exit = ttk.Button(self, text="Salir de pantalla completa", command=lambda: self.event_generate('<Escape>'))
        btn_exit.pack(pady=10)
