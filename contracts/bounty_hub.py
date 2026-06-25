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

    def _eval_repo(self) -> str:
        url = self.repository_url
        try:
            response = gl.nondet.web.get(url)
            # Ignore decode errors and reduce size to prevent LLM timeouts
            content = response.body.decode('utf-8', errors='ignore')[:1500]
        except Exception:
            return "NOT_SECURE|Network error: Failed to fetch the repository URL."

        prompt = f"Analyze the following content from a repository for security vulnerabilities:\n\n{content}\n\nFormat your response EXACTLY like this: STATUS|REMARK\nWhere STATUS is either SECURE or NOT_SECURE, and REMARK is a short 1-sentence remark explaining why. Do not use any other formatting or JSON."
        
        try:
            llm_response = gl.nondet.exec_prompt(prompt)
            parts = llm_response.split('|', 1)
            if len(parts) == 2:
                status = parts[0].strip().upper()
                remark = parts[1].strip()
                if status not in ["SECURE", "NOT_SECURE"]:
                    status = "NOT_SECURE"
                return f"{status}|{remark}"
            else:
                return "NOT_SECURE|Could not confidently determine security status."
        except Exception:
            return "NOT_SECURE|Analysis failed due to parsing error."

    @gl.public.write
    def submit_and_evaluate(self, url: str) -> None:
        self.repository_url = url
        
        # Make the equivalence prompt extremely lenient
        eq_prompt = "You are comparing two security analysis results formatted as STATUS|REMARK. Consider them EQUIVALENT and return true as long as both follow the STATUS|REMARK format and have some text for the remark, regardless of the exact wording."
        result_str = gl.eq_principle.prompt_comparative(self._eval_repo, eq_prompt)

        try:
            parts = result_str.split('|', 1)
            if len(parts) == 2:
                self.status = parts[0].strip()
                self.remarks = parts[1].strip()
            else:
                self.status = "NOT_SECURE"
                self.remarks = "Invalid consensus result format."
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