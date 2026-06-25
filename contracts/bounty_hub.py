# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

class AetheraConsensusDiagnostics(gl.Contract):
    repository_url: str
    status: str
    remarks: str

    def __init__(self, initial_url: str):
        self.repository_url = initial_url
        self.status = "READY"
        self.remarks = "Awaiting evaluation"

    @gl.public.write
    def submit_and_evaluate(self, url: str) -> None:
        self.repository_url = url
        
        def eval_repo() -> str:
            import json
            try:
                response = gl.nondet.web.get(url)
                content = response.body.decode('utf-8')[:4000]
            except Exception:
                return json.dumps({"status": "NOT_SECURE", "remarks": "Failed to fetch the URL."})

            prompt = f"Analyze the following code or content from the repository for security vulnerabilities (e.g. exposed secrets, vulnerabilities):\n\n{content}\n\nFormat your response strictly as a JSON object with 'status' (either 'SECURE' or 'NOT_SECURE') and 'remarks' (specific remarks explaining the status)."
            
            try:
                llm_response = gl.nondet.exec_prompt(prompt, response_format="json")
                parsed = json.loads(llm_response)
                return json.dumps({
                    "status": parsed.get("status", "NOT_SECURE"),
                    "remarks": parsed.get("remarks", "Could not determine.")
                }, sort_keys=True)
            except Exception:
                return json.dumps({"status": "NOT_SECURE", "remarks": "Failed to analyze the content."})

        eq_prompt = "Compare the two security analysis results. They are equivalent if they report the same final 'status' and the 'remarks' convey the same overall semantic meaning."
        result_str = gl.eq_principle.prompt_comparative(eval_repo, eq_prompt)

        import json
        try:
            parsed_result = json.loads(result_str)
            self.status = parsed_result.get("status", "NOT_SECURE")
            self.remarks = parsed_result.get("remarks", "Analysis error.")
        except Exception:
            self.status = "NOT_SECURE"
            self.remarks = "Failed to parse consensus result."

    @gl.public.view
    def get_status(self) -> str:
        return self.status

    @gl.public.view
    def get_remarks(self) -> str:
        return self.remarks

    @gl.public.view
    def get_repository(self) -> str:
        return self.repository_url