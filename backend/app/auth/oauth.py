"""OAuth2 providers."""

from typing import Optional, Dict, Any
from dataclasses import dataclass

import httpx

from app.config import get_settings

settings = get_settings()


@dataclass
class OAuthUserInfo:
    """User info from OAuth provider."""
    provider: str
    provider_id: str
    email: str
    name: str
    avatar_url: Optional[str] = None


class GoogleOAuthProvider:
    """Google OAuth2 provider."""
    
    AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    
    def __init__(self):
        self.client_id = settings.google_client_id
        self.client_secret = settings.google_client_secret
        self.redirect_uri = settings.google_redirect_uri
    
    def get_authorization_url(self, state: str) -> str:
        """
        Get the Google OAuth2 authorization URL.
        
        Args:
            state: CSRF state token
            
        Returns:
            Authorization URL to redirect user to
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.AUTHORIZE_URL}?{query}"
    
    async def exchange_code(self, code: str) -> Optional[Dict[str, Any]]:
        """
        Exchange authorization code for tokens.
        
        Args:
            code: Authorization code from callback
            
        Returns:
            Token response or None if failed
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.redirect_uri,
                },
            )
            
            if response.status_code != 200:
                return None
            
            return response.json()
    
    async def get_user_info(self, access_token: str) -> Optional[OAuthUserInfo]:
        """
        Get user info from Google.
        
        Args:
            access_token: Google access token
            
        Returns:
            OAuthUserInfo or None if failed
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            
            return OAuthUserInfo(
                provider="google",
                provider_id=data.get("id", ""),
                email=data.get("email", ""),
                name=data.get("name", ""),
                avatar_url=data.get("picture"),
            )


# Singleton instance
google_oauth = GoogleOAuthProvider()
