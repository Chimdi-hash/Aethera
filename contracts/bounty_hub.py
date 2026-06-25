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
        try:
            url = self.repository_url
            # If it's a standard github url, try fetching the README directly to avoid huge HTML payloads and 403s
            if "github.com" in url and "raw.githubusercontent.com" not in url:
                parts = url.rstrip("/").split("github.com/")
                if len(parts) == 2:
                    repo_path = parts[1]
                    url = f"https://raw.githubusercontent.com/{repo_path}/main/README.md"

            response = gl.nondet.web.get(url)
            content = response.body.decode('utf-8', errors='ignore')[:1500]
        except Exception as e:
            return f"NOT_SECURE|Network error: {type(e).__name__} - {str(e)}"

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
                return f"NOT_SECURE|Invalid LLM output format: {llm_response[:100]}"
        except Exception as e:
            return f"NOT_SECURE|Analysis failed: {type(e).__name__} - {str(e)}"

    @gl.public.write
    def submit_and_evaluate(self, url: str) -> None:
        try:
            self.repository_url = url
            
            eq_prompt = "You are comparing two security analysis results formatted as STATUS|REMARK. Consider them EQUIVALENT and return true as long as both follow the STATUS|REMARK format and have some text for the remark, regardless of the exact wording."
            
            # Pass ONLY the bound method and the prompt (2 arguments!)
            result_str = gl.eq_principle.prompt_comparative(self._eval_repo, eq_prompt)

            parts = result_str.split('|', 1)
            if len(parts) == 2:
                self.status = parts[0].strip()
                self.remarks = parts[1].strip()
            else:
                self.status = "NOT_SECURE"
                self.remarks = "Invalid consensus result format."
        except BaseException as e:
            self.status = "NOT_SECURE"
            self.remarks = f"GenVM Runtime Error: {type(e).__name__} - {str(e)}"

    @gl.public.view
    def get_status(self) -> str:
        return self.status

    @gl.public.view
    def get_remarks(self) -> str:
        return self.remarks

    @gl.public.view
    def get_repository(self) -> str:
        return self.repository_url