# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/0e06bfdc-afe5-4ca8-9b6c-26b8e07ab174

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/0e06bfdc-afe5-4ca8-9b6c-26b8e07ab174) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/0e06bfdc-afe5-4ca8-9b6c-26b8e07ab174) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

---

## AI Guru: Models, Timeouts, Streaming, RAG
- Model routing: chatbot/summaries → gpt-5.0-nano; exam generation → gpt-5.0-pro
- Timeouts: client 60s; edge completions 60s; embeddings 30s; max_tokens 1024
- Streaming: Server-Sent Events (text/event-stream) from edge → UI
- RAG: seed/refresh in 500-doc batches, chunk size 800/overlap 120, includes blogs + help; retrieval top-8 with URL dedupe

## Environment Variables
Copy `.env.example` to your environment and set:
- OPENAI_API_KEY
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- EMBEDDING_MODEL (default text-embedding-3-small)
- EMBEDDING_DIM (default 1536)

