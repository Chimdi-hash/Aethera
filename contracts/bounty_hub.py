# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

class AetheraConsensusDiagnostics(gl.Contract):
    repository_url: str
    status: str
    remarks: str
    bounty_released: bool

    def __init__(self, initial_url: str):
        self.repository_url = initial_url
        self.status = "READY"
        self.remarks = "Awaiting evaluation"
        self.bounty_released = False

    @gl.public.write
    def submit_and_evaluate(self, url: str) -> None:
        try:
            # Save to deterministic storage
            self.repository_url = url
            
            # Capture the input variable for the closure.
            target_url = url
            
            # Define the nondet block as a closure taking 0 arguments.
            def _eval_repo_closure() -> str:
                import json
                import base64
                
                fetch_url = target_url
                content_to_analyze = ""
                
                if "github.com" in fetch_url and "raw.githubusercontent.com" not in fetch_url:
                    parts = fetch_url.split("github.com/")
                    if len(parts) == 2:
                        repo_path = parts[1]
                        if repo_path.endswith("/"):
                            repo_path = repo_path[:-1]
                        api_url = "https://api.github.com/repos/" + repo_path + "/readme"
                        try:
                            response = gl.nondet.web.get(api_url)
                            data = json.loads(response.body.decode('utf-8'))
                            if 'content' in data:
                                content_to_analyze = base64.b64decode(data['content']).decode('utf-8', errors='ignore')
                        except Exception as e:
                            pass
                
                if not content_to_analyze:
                    try:
                        response = gl.nondet.web.get(fetch_url)
                        content_to_analyze = response.body.decode('utf-8', errors='ignore')
                    except Exception as e:
                        return "NOT_SECURE|Fetch Error: " + str(e)

                content_to_analyze = content_to_analyze[:1500]

                prompt = "Analyze the following content from a repository for security vulnerabilities:\n\n" + content_to_analyze + "\n\nFormat your response EXACTLY like this: STATUS|REMARK\nWhere STATUS is either SECURE or NOT_SECURE, and REMARK is a short 1-sentence remark explaining why. Do not use any other formatting or JSON."
                
                try:
                    llm_response = gl.nondet.exec_prompt(prompt)
                    parts = llm_response.split('|', 1)
                    if len(parts) == 2:
                        status = parts[0].strip().upper()
                        remark = parts[1].strip()
                        if status not in ["SECURE", "NOT_SECURE"]:
                            status = "NOT_SECURE"
                        return status + "|" + remark
                    else:
                        return "NOT_SECURE|Invalid LLM output format."
                except Exception as e:
                    return "NOT_SECURE|Analysis failed: " + str(e)
            
            eq_prompt = "You are comparing two security analysis results formatted as STATUS|REMARK. Consider them EQUIVALENT and return true as long as both follow the STATUS|REMARK format and have some text for the remark, regardless of the exact wording."
            
            # Pass the closure with exactly 2 arguments
            result_str = gl.eq_principle.prompt_comparative(_eval_repo_closure, eq_prompt)

            parts = result_str.split('|', 1)
            if len(parts) == 2:
                self.status = parts[0].strip()
                self.remarks = parts[1].strip()
                
                # ==== ADJUDICATION WORKFLOW ====
                # Connect the consensus verdict to a tangible outcome
                if self.status == "SECURE":
                    self.bounty_released = True
                else:
                    self.bounty_released = False
            else:
                self.status = "NOT_SECURE"
                self.remarks = "Invalid consensus result format."
                self.bounty_released = False

        except BaseException as e:
            self.status = "NOT_SECURE"
            self.remarks = "GenVM Runtime Error: " + str(e)
            self.bounty_released = False

    @gl.public.view
    def get_status(self) -> str:
        return self.status

    @gl.public.view
    def get_remarks(self) -> str:
        return self.remarks

    @gl.public.view
    def get_repository(self) -> str:
        return self.repository_url

    @gl.public.view
    def is_bounty_released(self) -> bool:
        return self.bounty_released