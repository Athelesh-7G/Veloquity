"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, HelpCircle, MessageSquare, BookOpen, ChevronDown, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface ContextPanelProps {
  isOpen: boolean
  onClose: () => void
}

const glossaryTerms = [
  {
    term: "Confidence Score",
    definition:
      "A probability-like measure indicating how strongly the evidence supports a given conclusion. Always presented with uncertainty bounds.",
  },
  {
    term: "Uncertainty Range",
    definition:
      "The interval within which the true confidence likely falls. Wider ranges indicate less certainty in the evidence base.",
  },
  {
    term: "Evidence Item",
    definition:
      "A normalized, traceable piece of user feedback that has been processed and linked to themes or decisions.",
  },
  {
    term: "Theme",
    definition:
      "A recurring pattern or topic identified across multiple feedback items, used to cluster related signals.",
  },
]

const comments = [
  {
    id: "1",
    author: "Sarah M.",
    content: "Should we prioritize the mobile stability theme? Evidence looks strong.",
    time: "2h ago",
  },
  {
    id: "2",
    author: "Alex K.",
    content: "Agreed. The uncertainty range is tight enough to act on.",
    time: "1h ago",
  },
]

export function ContextPanel({ isOpen, onClose }: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState<"help" | "glossary" | "comments">("help")
  const [newComment, setNewComment] = useState("")
  const [expandedTerms, setExpandedTerms] = useState<string[]>([])

  const toggleTerm = (term: string) => {
    setExpandedTerms((prev) => (prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term]))
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-[calc(100vh-64px)] border-l border-border bg-background flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Context</h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {[
              { id: "help", icon: HelpCircle, label: "Help" },
              { id: "glossary", icon: BookOpen, label: "Glossary" },
              { id: "comments", icon: MessageSquare, label: "Comments" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-foreground border-b-2 border-violet-500"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "help" && (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-blue-500/10 to-violet-500/10 rounded-xl border border-blue-500/20">
                  <h4 className="font-medium text-foreground mb-2">Quick Tips</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-violet-500">•</span>
                      <span>Use keyboard shortcuts for faster navigation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-violet-500">•</span>
                      <span>Click any confidence score to see its full uncertainty breakdown</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-violet-500">•</span>
                      <span>Filter by source to focus on specific channels</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-foreground mb-2">Keyboard Shortcuts</h4>
                  <div className="space-y-2">
                    {[
                      { keys: ["⌘", "K"], action: "Global search" },
                      { keys: ["⌘", "N"], action: "New feedback" },
                      { keys: ["⌘", "I"], action: "Import data" },
                      { keys: ["?"], action: "Open help" },
                    ].map((shortcut) => (
                      <div key={shortcut.action} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{shortcut.action}</span>
                        <div className="flex gap-1">
                          {shortcut.keys.map((key) => (
                            <kbd
                              key={key}
                              className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-muted-foreground"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "glossary" && (
              <div className="space-y-2">
                {glossaryTerms.map((item) => (
                  <div key={item.term} className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleTerm(item.term)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-accent transition-colors"
                    >
                      <span className="font-medium text-sm text-foreground">{item.term}</span>
                      <motion.div
                        animate={{ rotate: expandedTerms.includes(item.term) ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {expandedTerms.includes(item.term) && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <p className="px-3 pb-3 text-sm text-muted-foreground">{item.definition}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "comments" && (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{comment.author}</span>
                      <span className="text-xs text-muted-foreground">{comment.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comment input (only for comments tab) */}
          {activeTab === "comments" && (
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[60px] resize-none"
                />
              </div>
              <Button
                size="sm"
                className="mt-2 w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
              >
                <Send className="w-3 h-3 mr-2" />
                Send
              </Button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
