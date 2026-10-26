// A fixed studio week, used only by the demo hook. No network or clock input.
export const demoTimestamp = Date.UTC(2026, 9, 19, 13)
export const demoPeople = [['nina', 'Nina Patel'], ['eli', 'Eli Brooks'], ['maya', 'Maya Chen']] as const

export const demoProjects = [
  { id: 'prj_demo_launch', name: 'Autumn collection launch', description: 'Bring the new collection from approved story to launch day.', dueDate: '2026-11-06' },
  { id: 'prj_demo_website', name: 'Studio website refresh', description: 'A clearer portfolio, faster pages and a better enquiry journey.', dueDate: '2026-11-13' },
  { id: 'prj_demo_customer', name: 'Customer stories', description: 'Three recent customers, photographed and ready to share.', dueDate: '2026-11-20' },
] as const

type TaskSpec = [project: number, title: string, description: string, status: 'todo' | 'doing' | 'done', assignee: 'owner' | 'nina' | 'eli' | 'maya', due: string, priority: 'low' | 'normal' | 'high' | 'urgent', hours: number]
const tasks: TaskSpec[] = [
  [0, 'Approve the collection brief', 'Agree the audience, story and launch deliverables with the studio team.', 'done', 'owner', '2026-10-20', 'high', 2],
  [0, 'Photograph the hero collection', 'Capture the five hero products in warm afternoon light.', 'doing', 'nina', '2026-10-27', 'high', 6],
  [0, 'Review launch email copy', 'Check product names, tone and the final call to action before design.', 'doing', 'owner', '2026-10-28', 'high', 2],
  [0, 'Build the launch landing page', 'Assemble the approved story, photography and collection details.', 'todo', 'eli', '2026-11-02', 'normal', 8],
  [0, 'Complete the launch checklist', 'Confirm stock, links and customer support notes with each owner.', 'todo', 'maya', '2026-11-05', 'urgent', 3],
  [1, 'Audit the current portfolio', 'Choose the strongest work and identify outdated case studies.', 'done', 'maya', '2026-10-21', 'normal', 3],
  [1, 'Sketch the new project page', 'Explore a simple page that gives each project room to tell its story.', 'doing', 'nina', '2026-10-29', 'high', 5],
  [1, 'Review the navigation proposal', 'Check the route from first visit to a useful project enquiry.', 'todo', 'owner', '2026-10-30', 'normal', 2],
  [1, 'Improve mobile image loading', 'Resize portfolio images and check the first visit on a phone.', 'todo', 'eli', '2026-11-06', 'normal', 4],
  [1, 'Check the enquiry journey', 'Walk through the form, confirmation and studio handoff together.', 'todo', 'maya', '2026-11-12', 'high', 2],
  [2, 'Choose three customer stories', 'Pick a mix of new brands and long-term studio partners.', 'done', 'owner', '2026-10-22', 'normal', 2],
  [2, 'Prepare interview questions', 'Focus each conversation on the customer challenge and the result.', 'doing', 'maya', '2026-10-28', 'normal', 3],
  [2, 'Schedule the portrait sessions', 'Agree a location and a ninety-minute slot with each customer.', 'todo', 'nina', '2026-11-03', 'normal', 2],
  [2, 'Draft the first customer story', 'Turn the interview notes into a concise story for customer review.', 'todo', 'owner', '2026-11-10', 'high', 4],
  [2, 'Lay out the story collection', 'Build a consistent layout for the three approved stories.', 'todo', 'eli', '2026-11-18', 'low', 5],
]

export const demoTasks = tasks.map(([project, title, description, status, assignee, dueDate, priority, hours], index) => ({
  id: `tsk_demo_${String(index + 1).padStart(2, '0')}`, projectId: demoProjects[project].id,
  title, description, status, assignee, dueDate, priority, hours,
}))

export const demoComments = [
  { id: 'cmt_demo_photos', taskId: 'tsk_demo_02', projectId: demoProjects[0].id, author: 'nina', body: 'The studio is booked for Tuesday. I will bring the linen backdrop and start with the hero products.' },
  { id: 'cmt_demo_copy', taskId: 'tsk_demo_03', projectId: demoProjects[0].id, author: 'maya', body: 'The revised draft is ready for your review, Wes. The collection names now match the approved brief.' },
  { id: 'cmt_demo_navigation', taskId: 'tsk_demo_08', projectId: demoProjects[1].id, author: 'eli', body: 'The proposal keeps Work and Contact one tap away on mobile. Ready to walk through it together.' },
]
