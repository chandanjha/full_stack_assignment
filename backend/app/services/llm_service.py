import httpx


class LLMService:
    def __init__(
        self,
        provider: str,
        base_url: str,
        model: str,
        timeout_seconds: int,
        grok_base_url: str = "",
        grok_api_key: str = "",
        gpt_base_url: str = "",
        gpt_api_key: str = "",
    ):
        self.provider = provider.strip().lower()
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.grok_base_url = grok_base_url.rstrip("/")
        self.grok_api_key = grok_api_key
        self.gpt_base_url = gpt_base_url.rstrip("/")
        self.gpt_api_key = gpt_api_key

    def summarize_book(self, content: str, title: str, author: str | None) -> str:
        prompt = self._build_summary_prompt(content, title, author)
        return self._run_prompt(prompt)

    def summarize_reviews(
        self,
        reviews_text: str,
        title: str,
        average_rating: float,
        review_count: int,
        positive_count: int,
        critical_count: int,
    ) -> str:
        prompt = self._build_review_prompt(
            reviews_text=reviews_text,
            title=title,
            average_rating=average_rating,
            review_count=review_count,
            positive_count=positive_count,
            critical_count=critical_count,
        )
        return self._run_prompt(prompt)

    def summarize_preferences(self, preference_context: str) -> str:
        prompt = self._build_preference_prompt(preference_context)
        return self._run_prompt(prompt)

    def rank_content_recommendations(
        self,
        reader_profile: str,
        candidate_catalog: str,
        limit: int,
    ) -> str:
        prompt = self._build_content_recommendation_prompt(
            reader_profile=reader_profile,
            candidate_catalog=candidate_catalog,
            limit=limit,
        )
        return self._run_prompt(prompt)

    def _run_prompt(self, prompt: str) -> str:
        if self.provider == "ollama":
            return self._summarize_with_ollama(prompt)
        if self.provider == "grok":
            return self._summarize_with_grok(prompt)
        if self.provider in {"gpt", "chatgpt", "openai"}:
            return self._summarize_with_chatgpt(prompt)
        raise ValueError(f"Unsupported LLM provider: {self.provider}")

    def _summarize_with_ollama(self, prompt: str) -> str:
        try:
            response = httpx.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                },
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = self._extract_error_detail(exc.response)
            raise RuntimeError(f"LLM request failed: {detail}") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(f"LLM request failed: {exc}") from exc

        payload = response.json()
        summary = (payload.get("response") or "").strip()
        if not summary:
            raise ValueError("LLM response did not include a summary")
        return summary

    def _summarize_with_grok(self, prompt: str) -> str:
        if not self.grok_api_key:
            raise RuntimeError("GROK_API_KEY is not configured")

        try:
            response = httpx.post(
                f"{self.grok_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.grok_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a concise, accurate digital library analysis assistant.",
                        },
                        {
                            "role": "user",
                            "content": prompt,
                        },
                    ],
                    "temperature": 0.2,
                },
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = self._extract_error_detail(exc.response)
            raise RuntimeError(f"LLM request failed: {detail}") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(f"LLM request failed: {exc}") from exc

        payload = response.json()
        choices = payload.get("choices") or []
        if not choices:
            raise ValueError("Grok response did not include choices")

        message = choices[0].get("message") or {}
        summary = (message.get("content") or "").strip()
        if not summary:
            raise ValueError("Grok response did not include summary content")
        return summary

    def _summarize_with_chatgpt(self, prompt: str) -> str:
        if not self.gpt_api_key:
            raise RuntimeError("GPT_API_KEY is not configured")

        try:
            response = httpx.post(
                f"{self.gpt_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.gpt_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a concise, accurate digital library analysis assistant.",
                        },
                        {
                            "role": "user",
                            "content": prompt,
                        },
                    ],
                    "temperature": 0.2,
                },
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = self._extract_error_detail(exc.response)
            raise RuntimeError(f"LLM request failed: {detail}") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(f"LLM request failed: {exc}") from exc

        payload = response.json()
        choices = payload.get("choices") or []
        if not choices:
            raise ValueError("ChatGPT response did not include choices")

        message = choices[0].get("message") or {}
        summary = (message.get("content") or "").strip()
        if not summary:
            raise ValueError("ChatGPT response did not include summary content")
        return summary

    def _extract_error_detail(self, response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            payload = None

        if isinstance(payload, dict):
            detail = payload.get("error") or payload.get("message") or payload.get("detail")
            if detail:
                return f"{response.status_code} {response.reason_phrase}: {detail}"

        response_text = response.text.strip()
        if response_text:
            return f"{response.status_code} {response.reason_phrase}: {response_text}"

        return f"{response.status_code} {response.reason_phrase}"

    def _build_summary_prompt(self, content: str, title: str, author: str | None) -> str:
        author_context = author or "Unknown author"
        return (
            "You are an assistant for a digital library.\n"
            "Write a concise, reader-friendly summary for the following book.\n"
            "Requirements:\n"
            "- Keep it under 140 words.\n"
            "- Focus on the key themes, subject, or plot.\n"
            "- Do not mention that you are an AI.\n"
            "- Do not invent details not supported by the text.\n\n"
            f"Title: {title}\n"
            f"Author: {author_context}\n\n"
            "Book Content:\n"
            f"{content}"
        )

    def _build_review_prompt(
        self,
        reviews_text: str,
        title: str,
        average_rating: float,
        review_count: int,
        positive_count: int,
        critical_count: int,
    ) -> str:
        return (
            "You are an assistant for a digital library.\n"
            "Create a structured reader-consensus summary for the book below.\n"
            "Requirements:\n"
            "- Keep it under 180 words.\n"
            "- Stay grounded only in the supplied reviews and rating statistics.\n"
            "- Use exactly these section labels in plain text:\n"
            "  Sentiment Summary:\n"
            "  Themes:\n"
            "  Pros:\n"
            "  Cons:\n"
            "  Average Rating Context:\n"
            "- For Themes, Pros, and Cons, keep each concise and comma-separated.\n"
            "\n"
            f"Title: {title}\n\n"
            "Rating Snapshot:\n"
            f"- Average rating: {average_rating:.1f}/5\n"
            f"- Total reviews: {review_count}\n"
            f"- Positive reviews (4-5): {positive_count}\n"
            f"- Critical reviews (1-2): {critical_count}\n\n"
            "Reviews:\n"
            f"{reviews_text}"
        )

    def _build_preference_prompt(self, preference_context: str) -> str:
        return (
            "You are an assistant for a digital library.\n"
            "Summarize this reader's preferences in one concise sentence.\n"
            "Focus on favored tags, authors, and reading tendencies.\n\n"
            f"{preference_context}"
        )

    def _build_content_recommendation_prompt(
        self,
        reader_profile: str,
        candidate_catalog: str,
        limit: int,
    ) -> str:
        safe_limit = max(limit, 1)
        return (
            "You are an assistant for a digital library.\n"
            "Rank candidate books using content-based filtering only.\n"
            "Use the reader profile plus each book's title, author, tags, and summary.\n"
            "Do not use popularity, collaborative signals, or any information outside the prompt.\n"
            "Return only a JSON array with at most "
            f"{safe_limit} item(s).\n"
            "Each array item must contain:\n"
            '- "book_id": a candidate book id exactly as provided\n'
            '- "score": an integer from 1 to 100\n'
            '- "reasons": an array of 1 to 3 short strings grounded in content fit\n\n'
            "Reader Profile:\n"
            f"{reader_profile}\n\n"
            "Candidate Books:\n"
            f"{candidate_catalog}"
        )
