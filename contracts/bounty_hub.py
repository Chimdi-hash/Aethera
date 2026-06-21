# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


# contract class
class BountyHub(gl.Contract):
    status: str

    # constructor
    def __init__(self, initial_status: str):
        self.status = initial_status

    # read methods must be annotated with view
    @gl.public.view
    def get_status(self) -> str:
        return self.status

    # write method formatted EXACTLY like the official guide
    @gl.public.write
    def submit_and_evaluate(self, url: str) -> None:
        # Step 1: Define the isolated non-deterministic function inside the method
        def my_non_deterministic_block():
            # First, check deterministically if it looks like a GitHub URL
            if "github.com" not in url.lower():
                raise ValueError("Validators rejected this entry: The URL does not point to github.com.")
            
            # Grabs the web page content safely
            web_data = gl.nondet.web.render(url, mode="text")
            
            # Ask the AI Validator to confirm it's a valid GitHub repository
            task = (
                f"Analyze the following web page content and confirm if it is a valid GitHub repository. "
                f"Reply strictly with 'yes' or 'no'.\n\nContent snippet:\n{web_data[:2000]}"
            )
            response = gl.nondet.llm.call(task)
            
            # If the AI says it's not a GitHub repo, raise an error to cancel the transaction
            if "yes" not in response.lower():
                raise ValueError("Validators rejected this entry: Not recognized as a valid GitHub repository.")
                
            return True

        # Step 2: Run the consensus wrapper just like the guide example
        is_valid = gl.eq_principle.strict_eq(my_non_deterministic_block)

        # Step 3: Update the deterministic state based on the result
        if is_valid:
            self.status = "Approved"
        else:
            self.status = "Rejected"