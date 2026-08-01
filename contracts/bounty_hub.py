# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

@gl.evm.contract_interface
class _Recipient:
    class View: pass
    class Write: pass

class AetheraConsensusDiagnostics(gl.Contract):
    repository_url: str
    status: str
    remarks: str
    bounty_released: bool

    bounties: TreeMap[str, u256]
    bounty_sponsors: TreeMap[str, str]
    active_urls: DynArray[str]

    def __init__(self, initial_url: str):
        self.repository_url = initial_url
        self.status = "READY"
        self.remarks = "Awaiting evaluation"
        self.bounty_released = False

    @gl.public.write.payable
    def fund_bounty(self, url: str) -> None:
        amount = u256(gl.message.value)
        if url in self.bounties and self.bounties[url] > u256(0):
            self.bounties[url] += amount
        else:
            self.bounties[url] = amount
        
        self.bounty_sponsors[url] = str(gl.message.sender_address)
        
        if url not in self.active_urls:
            self.active_urls.append(url)

    @gl.public.write.payable
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
                        if repo_path.endswith(".git"):
                            repo_path = repo_path[:-4]
                        try:
                            # 1. Fetch latest commit SHA
                            commit_api = "https://api.github.com/repos/" + repo_path + "/commits/HEAD"
                            commit_res = gl.nondet.web.get(commit_api)
                            commit_data = json.loads(commit_res.body.decode('utf-8'))
                            commit_sha = commit_data.get('sha', '')
                            
                            if commit_sha:
                                content_to_analyze += f"Target Commit SHA: {commit_sha}\n\n"
                                
                                # 2. Fetch source tree for that commit
                                tree_api = "https://api.github.com/repos/" + repo_path + "/git/trees/" + commit_sha + "?recursive=1"
                                tree_res = gl.nondet.web.get(tree_api)
                                tree_data = json.loads(tree_res.body.decode('utf-8'))
                                paths = [item['path'] for item in tree_data.get('tree', []) if item.get('type') == 'blob']
                                content_to_analyze += "Repository Architecture (Tree):\n" + "\n".join(paths[:30]) + "\n\n"
                                
                            # 3. Fetch README
                            readme_api = "https://api.github.com/repos/" + repo_path + "/readme"
                            readme_res = gl.nondet.web.get(readme_api)
                            readme_data = json.loads(readme_res.body.decode('utf-8'))
                            if 'content' in readme_data:
                                readme_content = base64.b64decode(readme_data['content']).decode('utf-8', errors='ignore')
                                content_to_analyze += "README File:\n" + readme_content
                        except Exception as e:
                            pass
                
                if not content_to_analyze:
                    try:
                        response = gl.nondet.web.get(fetch_url)
                        content_to_analyze = response.body.decode('utf-8', errors='ignore')
                    except Exception as e:
                        return "NON_COMPLIANT|Fetch Error: " + str(e)

                content_to_analyze = content_to_analyze[:2500]

                prompt = "Analyze the following content from a repository for security vulnerabilities:\n\n" + content_to_analyze + "\n\nFormat your response EXACTLY like this: STATUS|REMARK\nWhere STATUS is either COMPLIANT or NON_COMPLIANT, and REMARK is a short 1-sentence remark explaining why. Do not use any other formatting or JSON."
                
                try:
                    llm_response = gl.nondet.exec_prompt(prompt)
                    parts = llm_response.split('|', 1)
                    if len(parts) == 2:
                        status = parts[0].strip().upper()
                        remark = parts[1].strip()
                        if status not in ["COMPLIANT", "NON_COMPLIANT"]:
                            status = "NON_COMPLIANT"
                        return status + "|" + remark
                    else:
                        return "NON_COMPLIANT|Invalid LLM output format."
                except Exception as e:
                    return "NON_COMPLIANT|Analysis failed: " + str(e)
            
            eq_prompt = "You are comparing two security analysis results formatted as STATUS|REMARK. Consider them EQUIVALENT ONLY if the STATUS portion (e.g., COMPLIANT or NON_COMPLIANT) is exactly identical. The REMARK portion can differ in wording as long as the underlying reasoning is similar."
            
            # Pass the closure with exactly 2 arguments
            result_str = gl.eq_principle.prompt_comparative(_eval_repo_closure, eq_prompt)

            parts = result_str.split('|', 1)
            if len(parts) == 2:
                self.status = parts[0].strip()
                self.remarks = parts[1].strip()
                
                # ==== ADJUDICATION WORKFLOW ====
                # Connect the consensus verdict to a tangible outcome
                if self.status == "COMPLIANT":
                    bounty_amt = self.bounties.get(url, u256(0))
                    if bounty_amt > u256(0):
                        target = _Recipient(gl.message.sender_address)
                        target.emit_transfer(value=bounty_amt, on='finalized')
                        self.bounties[url] = u256(0)
                        self.bounty_released = True
                        if url in self.active_urls:
                            self.active_urls.remove(url)
                    else:
                        self.bounty_released = False
                else:
                    self.bounty_released = False
            else:
                self.status = "NON_COMPLIANT"
                self.remarks = "Invalid consensus result format."
                self.bounty_released = False

        except BaseException as e:
            self.status = "NON_COMPLIANT"
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

    @gl.public.view
    def get_bounty_sponsor(self, url: str) -> str:
        return self.bounty_sponsors.get(url, "")

    @gl.public.view
    def get_active_bounties(self) -> str:
        import json
        result = {}
        for url in self.active_urls:
            amt = self.bounties.get(url, u256(0))
            if amt > u256(0):
                result[url] = str(amt)
        return json.dumps(result)