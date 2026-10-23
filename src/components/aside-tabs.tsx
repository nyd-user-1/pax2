"use client"

import * as React from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/nova/tabs"

// The video page's aside column under the video (Brendan, 2026-10-23): A/V holds Audio, Channel, Tags and
// Comps; Comments holds the comments. Both stay mounted, so a thread keeps its state across a switch.

export function AsideTabs({ av, comments }: { av: React.ReactNode; comments: React.ReactNode }) {
  return (
    <Tabs defaultValue="av" className="mt-5 gap-0">
      <TabsList className="w-full">
        <TabsTrigger value="av">A/V</TabsTrigger>
        <TabsTrigger value="comments">Comments</TabsTrigger>
      </TabsList>
      <TabsContent value="av" keepMounted>
        {av}
      </TabsContent>
      <TabsContent value="comments" keepMounted>
        {comments}
      </TabsContent>
    </Tabs>
  )
}
