import tkinter as tk
from tkinter import ttk
from app.config import APP_TITLE, WINDOW_SIZE, FULLSCREEN
from app.ui.screens.home import HomeScreen

class App(tk.Tk):
    """Root Tkinter application with simple screen management."""

    def __init__(self) -> None:
        super().__init__()
        self.title(APP_TITLE)
        self.geometry(WINDOW_SIZE)
        if FULLSCREEN:
            self.attributes("-fullscreen", True)
            self.bind("<Escape>", self._exit_fullscreen)

        container = ttk.Frame(self)
        container.pack(fill=tk.BOTH, expand=True)

        self._screens = {}
        self._container = container

        self.show_home()

    def show_home(self) -> None:
        self._clear_container()
        screen = HomeScreen(self._container, on_navigate=self.navigate)
        screen.pack(fill=tk.BOTH, expand=True)
        self._screens['home'] = screen

    def navigate(self, route: str, **kwargs):
        # Placeholder router for future screens
        if route == 'home':
            self.show_home()
        else:
            self.show_home()

    def _clear_container(self) -> None:
        for widget in self._container.winfo_children():
            widget.destroy()

    def _exit_fullscreen(self, _event=None):
        self.attributes("-fullscreen", False)


def main():
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
