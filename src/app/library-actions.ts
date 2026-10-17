"use server"

import { libraryCards } from "@/lib/library-cards"

/** The script cards, fetched when the landing's Choose a script is pressed rather than on every load. */
export async function loadLibraryCards() {
  return libraryCards()
}
