# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

class AetheraConsensusDiagnostics(gl.Contract):
    repository_url: str
    status: str

    def __init__(self, initial_url: str):
        self.repository_url = initial_url
        self.status = "READY"

    @gl.public.write
    def submit_and_evaluate(self, url: str) -> None:
        self.repository_url = url
        self.status = "SUBMITTED"

    @gl.public.view
    def get_status(self) -> str:
        return self.status

    @gl.public.view
    def get_repository(self) -> str:
        return self.repository_url