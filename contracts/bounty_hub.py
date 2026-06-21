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
            # Check if it's a github commit link
            if "github.com" not in url.lower() or "/commit/" not in url.lower():
                return False
            # Grabs the web page content safely
            web_data = gl.nondet.web.render(url, mode="text")
            # Returns True if it finds 'commit', False if not
            return "commit" in web_data.lower()

        # Step 2: Run the consensus wrapper just like the guide example
        is_valid = gl.eq_principle.strict_eq(my_non_deterministic_block)

        # Step 3: Update the deterministic state based on the result
        if is_valid:
            self.status = "Approved"
        else:
            self.status = "Rejected"