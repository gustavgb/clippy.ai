# clippy.ai

In this project I will be creating a local-first bookmarking/research tool with built in notetaking capabilities. It is called **clippy.ai**.

## Tech stack

- Tauri V2
- Svelte
- Tailwind + DaisyUI
- Integration with Gemini API to summarize websites

## Dictionary

- Workspace: A JSON file containing bookmarks and an ID counter

## Data Storage

Data will be stored in a JSON file on the user's file system. It will have the following interface:

```ts
interface Workspace {
  idCounter: number;
  bookmarks: {
    id: number;
    title: string;
    note: string;
    tags: string[];
    summary: string;
    lastUpdated: string;
  };
}
```

## Design

The user interface must be very simple.

### Native menu

The native menu contains the following menu items:

- File
  - New workspace (adds to settings.json)
  - Open workspace (adds to settings.json)
  - Save
  - Save as
  - Close workspace (removes from settings.json)
  - Preferences
  - Quit
- Bookmarks
  - Add bookmark

### Bookmarks page

At the top there is a searchbar on the left and on the right is a button to add a new bookmark. There is a dropdown allowing the user to select between recently used workspaces. Below is a list of existing bookmarks on the left and possibly the opened bookmark on the right.

**1. Adding a bookmark**

Clicking the add bookmark button opens a dialog where the user can enter a URL. The dialog will have a button to cancel and one to proceed. If the URL is already in the data store, it should tell the user and prevent creation. If the bookmark is added, it will be opened.

**2. Opening a bookmark**

Bookmarks open on the right. Here the user can edit the link's tags and note. The title is automatically fetched from the URL and taken from the document title.

Additionally the AI summary will be shown. There is a button to reprompt the AI. If the Gemini token is not entered, the user is shown an appropriate message. The summary is not fetched initially, only when the user clicks the button.

**3. List of bookmarks**

Contains a list of all bookmarks sorted by ID in descending order. Each link will be shown along with its ID, title, tags and note

A bookmark in the list view can be clicked, which will open the bookmark.

**4. Searching bookmarks**

The user can search for bookmarks by using the search bar. The user can search by ID, title, tags, note and url. The search must be a fuzzy search. Results are shown in a list below ranked på relevance.

### Settings page

The settings page contains a text field to input a Gemini API token. The token is saved to the settings.json file (see below).

## Keyboard shortcuts

- `Ctrl+N` - Add bookmark
- `Ctrl+F` - Focus searchbar
- `Ctrl+Shift+N` - New workspace file
- `Ctrl+O` - Open workspace file
- `Ctrl+S` - Save
- `Ctrl+Shift+S` - Save as
- `Ctrl+Q` - Close (ask if unsaved changes)

## Technical details

The ID is automatically assigned from the incrementing counter: `idCounter` in the data store. An ID will never be reused.

When a JSON data file is opened, it must be watched for file changes. If any changes are detected, reload the data file automatically. Only react to 'modify' or 'remove' events. Use the tauri fs watch function.

The app will store settings, such as the last opened workspaces in a config file at `~/.config/clippy.ai/settings.json`. It must also be watched and reloaded when modify or remove events occur. If it is not present when the app starts, it must be created. When a data store file is opened, update the settings.json file accordingly.

Bookmarks can be edited any time they are open. Therefore an autosave feature must be implemented (1.5 seconds debounced), which will save the opened item.
