import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AuthoredBlogs from "./AuthoredBlogs";
import BlogsFeedbackList from "./BlogsFeedbackList";

type BlogStatus = 'draft' | 'in_review' | 'published' | 'rejected';

interface AuthoredBlogTabsProps {
  defaultTab?: BlogStatus | 'feedback';
}

export default function AuthoredBlogTabs({ defaultTab = 'draft' }: AuthoredBlogTabsProps) {
  return (
    <div className="p-0">
      <Tabs defaultValue={defaultTab} className="w-full">
        <div className="border-b px-4">
          <TabsList className="grid w-full grid-cols-5 bg-transparent">
            <TabsTrigger value="draft" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none">
              Drafts
            </TabsTrigger>
            <TabsTrigger value="in_review" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none">
              Submitted
            </TabsTrigger>
            <TabsTrigger value="published" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none">
              Published
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none">
              Rejected
            </TabsTrigger>
            <TabsTrigger value="feedback" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none">
              Feedback
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="draft" className="mt-0">
          <AuthoredBlogs filter="draft" />
        </TabsContent>
        
        <TabsContent value="in_review" className="mt-0">
          <AuthoredBlogs filter="in_review" />
        </TabsContent>
        
        <TabsContent value="published" className="mt-0">
          <AuthoredBlogs filter="published" />
        </TabsContent>
        
        <TabsContent value="rejected" className="mt-0">
          <AuthoredBlogs filter="rejected" />
        </TabsContent>
        
        <TabsContent value="feedback" className="mt-0">
          <div className="p-0">
            <BlogsFeedbackList />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}