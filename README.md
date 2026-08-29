# Kusoma

Independent tutors in Kenya only see a student for a few hours a week. Between sessions, homework sits unanswered, practice does not follow the CBC topic they assigned, and parents get little besides “they’re doing fine.” Generic chatbots do not know Grade 5 Maths strands, and tutors have no simple way to see who engaged, where a child is stuck, or to send a weekly note home.

Kusoma closes that gap: the tutor assigns a real CBC Mathematics topic, the student practices and gets homework help in chat (identify by phone, no login), and the tutor sees progress and can share a parent report. Tutoring is grounded in Kenya’s curriculum via a separate CBC API.

Tutors get a PWA dashboard (roster, assignments, engagement, weekly parent-report drafts). Claude runs on Amazon Bedrock. Chat sessions live in Redis; scheduled nudges and reports run in a worker. Auth and data sit in Supabase.

Student chat is web-first; the messaging layer is built so WhatsApp can be added later without changing tutoring logic.
