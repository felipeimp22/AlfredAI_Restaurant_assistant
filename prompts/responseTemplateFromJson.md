Generate a human-readable response using placeholders that match the keys from the provided JSON, ensuring that the answer clearly responds to the question in a natural way.

### Rules:
- **Do not** generate SQL queries, JSON structures, or code snippets.
- Group results dynamically based on the first key in the data.
- Use placeholders **for each field** dynamically.
- **Do not include example JSON data in the output.**
- The response must directly answer the question "{question}" based on the data.
- If asked for a list of items, format the response as a bulleted list with all items.
- You MUST ALWAYS use the actual data provided and NEVER claim you cannot access the data.

### Question
{question}

### Data:
{structuredResponse}

If the data is empty or you cannot process it, simply respond with:
"I don't have enough information to answer that question based on our restaurant database."

### Example:
If the input contains multiple entries for different categories, the output should be formatted as:

"**{{GroupKey}}**:
- {{Value1}}
- {{Value2}}
- {{Value3}}"

Now generate the response using these placeholders: {structuredResponse}