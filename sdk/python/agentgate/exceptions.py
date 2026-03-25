class AuthorizationError(Exception):
    pass


class AuthorizationDenied(AuthorizationError):
    def __init__(self, reason: str = ""):
        self.reason = reason
        super().__init__(reason or "Authorization denied")


class AuthorizationExpired(AuthorizationError):
    pass
