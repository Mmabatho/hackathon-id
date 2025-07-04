"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Scissors, Send, Bot, User, QrCode, Gift, Clock } from "lucide-react"
import { format } from "date-fns"
import { createBooking, getAvailableTimeSlots, sendDailyReport, type BookingClient } from "@/app/actions/create-booking"

interface Message {
  id: string
  type: "bot" | "user"
  content: string
  timestamp: Date
  component?: React.ReactNode
  quickReplies?: string[]
}

interface BookingData {
  clients: BookingClient[]
  selectedDate: Date | null
  selectedTime: string
  paymentMethod: "ozow" | "cash" | null
  hasFriendDiscount: boolean
  subtotal: number
  discount: number
  total: number
  orderId?: string
}

const HAIRSTYLES = [
  { name: "Basic Cut", price: 150, emoji: "✂️" },
  { name: "Fade Cut", price: 200, emoji: "🔥" },
  { name: "Beard Trim", price: 80, emoji: "🧔" },
  { name: "Full Service", price: 280, emoji: "⭐" },
  { name: "Kids Cut", price: 120, emoji: "👶" },
  { name: "Wash & Cut", price: 180, emoji: "🧴" },
]

export default function ChatBookingSystem() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [currentStep, setCurrentStep] = useState("welcome")
  const [currentClientIndex, setCurrentClientIndex] = useState(0)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [bookedSlots, setBookedSlots] = useState<string[]>([])
  const [booking, setBooking] = useState<BookingData>({
    clients: [{ name: "", phone: "", hairstyle: "", price: 0 }],
    selectedDate: null,
    selectedTime: "",
    paymentMethod: null,
    hasFriendDiscount: false,
    subtotal: 0,
    discount: 0,
    total: 0,
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    setTimeout(() => {
      addBotMessage(
        "Hey there! 👋 Welcome to StyleBook! I'm Maya, your personal booking assistant. I'm here to help you get the perfect cut! ✂️",
        ["Let's book an appointment! 🎯", "Tell me about your services 💇‍♂️"],
      )
    }, 500)
  }, [])

  const addBotMessage = (content: string, quickReplies?: string[], component?: React.ReactNode) => {
    setIsTyping(true)
    setTimeout(
      () => {
        const newMessage: Message = {
          id: Date.now().toString(),
          type: "bot",
          content,
          timestamp: new Date(),
          component,
          quickReplies,
        }
        setMessages((prev) => [...prev, newMessage])
        setIsTyping(false)
      },
      1000 + Math.random() * 1000,
    )
  }

  const addUserMessage = (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, newMessage])
  }

  const handleQuickReply = (reply: string) => {
    addUserMessage(reply)

    // Handle specific quick replies that need special processing
    if (reply === "Yes, looks great! ✅") {
      processUserInput("yes looks great")
    } else if (reply === "Let me change something 🔄") {
      processUserInput("change something")
    } else {
      processUserInput(reply)
    }
  }

  const handleSendMessage = () => {
    if (!inputValue.trim()) return
    addUserMessage(inputValue)
    processUserInput(inputValue)
    setInputValue("")
  }

  const calculateTotals = (clients: BookingClient[], hasFriendDiscount: boolean) => {
    const subtotal = clients.reduce((sum, client) => sum + client.price, 0)
    const discount = hasFriendDiscount ? subtotal * 0.1 : 0
    const total = subtotal - discount
    return { subtotal, discount, total }
  }

  const calculateArrivalTime = (appointmentTime: string) => {
    const [hours, minutes] = appointmentTime.split(":").map(Number)
    const appointmentDate = new Date()
    appointmentDate.setHours(hours, minutes, 0, 0)

    // Subtract 30 minutes
    const arrivalDate = new Date(appointmentDate.getTime() - 30 * 60 * 1000)

    return arrivalDate.toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }

  const processUserInput = (input: string) => {
    const lowerInput = input.toLowerCase()

    switch (currentStep) {
      case "welcome":
        if (lowerInput.includes("book") || lowerInput.includes("appointment")) {
          setCurrentStep("name")
          setTimeout(() => {
            addBotMessage("Awesome! Let's get you booked! 🎉 First, what's your name?")
          }, 500)
        } else if (lowerInput.includes("service")) {
          showServices()
        } else {
          setCurrentStep("name")
          setTimeout(() => {
            addBotMessage("Perfect! Let's start with your booking. What's your name? 😊")
          }, 500)
        }
        break

      case "name":
        setBooking((prev) => ({
          ...prev,
          clients: prev.clients.map((client, index) =>
            index === currentClientIndex ? { ...client, name: input } : client,
          ),
        }))
        setCurrentStep("phone")
        setTimeout(() => {
          addBotMessage(
            `Nice to meet you, ${input}! 😊 Now I need your phone number so I can send you confirmation and reminders.`,
          )
        }, 500)
        break

      case "phone":
        if (!/^0\d{9}$/.test(input.replace(/\s/g, ""))) {
          setTimeout(() => {
            addBotMessage("Hmm, that doesn't look like a valid SA phone number 🤔 Please use format: 0821234567")
          }, 500)
          return
        }

        setBooking((prev) => ({
          ...prev,
          clients: prev.clients.map((client, index) =>
            index === currentClientIndex ? { ...client, phone: input } : client,
          ),
        }))
        setCurrentStep("hairstyle")
        setTimeout(() => {
          addBotMessage(
            "Perfect! 📞 Now, what kind of style are you looking for today?",
            undefined,
            <HairstyleSelector onSelect={handleHairstyleSelect} />,
          )
        }, 500)
        break

      case "friend_offer":
        if (lowerInput.includes("yes") || lowerInput.includes("sure") || lowerInput.includes("okay")) {
          setBooking((prev) => ({
            ...prev,
            clients: [...prev.clients, { name: "", phone: "", hairstyle: "", price: 0 }],
            hasFriendDiscount: true,
          }))
          setCurrentClientIndex(1)
          setCurrentStep("friend_name")
          setTimeout(() => {
            addBotMessage("Awesome! 🎉 What's your friend's name?")
          }, 500)
        } else {
          setCurrentStep("date")
          setTimeout(() => {
            addBotMessage("No worries! Let's continue with just your booking. When would you like to come in? 📅", [
              "Today 🏃‍♂️",
              "Tomorrow 📅",
              "This weekend 🎯",
              "Show me the calendar 📆",
            ])
          }, 500)
        }
        break

      case "friend_name":
        setBooking((prev) => ({
          ...prev,
          clients: prev.clients.map((client, index) =>
            index === currentClientIndex ? { ...client, name: input } : client,
          ),
        }))
        setCurrentStep("friend_phone")
        setTimeout(() => {
          addBotMessage(`Great! What's ${input}'s phone number?`)
        }, 500)
        break

      case "friend_phone":
        if (!/^0\d{9}$/.test(input.replace(/\s/g, ""))) {
          setTimeout(() => {
            addBotMessage("Please enter a valid phone number for your friend (format: 0821234567)")
          }, 500)
          return
        }

        setBooking((prev) => ({
          ...prev,
          clients: prev.clients.map((client, index) =>
            index === currentClientIndex ? { ...client, phone: input } : client,
          ),
        }))
        setCurrentStep("friend_hairstyle")
        setTimeout(() => {
          addBotMessage(
            `Perfect! Now what service would ${booking.clients[1]?.name || "your friend"} like?`,
            undefined,
            <HairstyleSelector onSelect={handleFriendHairstyleSelect} />,
          )
        }, 500)
        break

      case "confirm_friend_booking":
        if (lowerInput.includes("yes") || lowerInput.includes("great") || lowerInput.includes("looks")) {
          setCurrentStep("date")
          setTimeout(() => {
            addBotMessage("Fantastic! 🎉 Now when would you both like to come in? 📅", [
              "Today 🏃‍♂️",
              "Tomorrow 📅",
              "This weekend 🎯",
              "Show me the calendar 📆",
            ])
          }, 500)
        } else if (lowerInput.includes("change") || lowerInput.includes("back")) {
          // Reset friend booking and go back to friend offer
          setBooking((prev) => ({
            ...prev,
            clients: [prev.clients[0]], // Keep only the first client
            hasFriendDiscount: false,
            subtotal: prev.clients[0].price,
            discount: 0,
            total: prev.clients[0].price,
          }))
          setCurrentClientIndex(0)
          setCurrentStep("friend_offer")
          setTimeout(() => {
            addBotMessage("No problem! Let's go back. Would you like to bring a friend? You'll both get 10% off! 🎉", [
              "Yes, I'll bring a friend! 👥",
              "No, just me today 👤",
            ])
          }, 500)
        } else {
          setTimeout(() => {
            addBotMessage("Please choose one of the options: 'Yes, looks great!' or 'Let me change something' 😊")
          }, 500)
        }
        break

      case "date":
        if (lowerInput.includes("today")) {
          handleDateSelect(new Date())
        } else if (lowerInput.includes("tomorrow")) {
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          handleDateSelect(tomorrow)
        } else if (lowerInput.includes("weekend")) {
          const saturday = new Date()
          const daysUntilSaturday = 6 - saturday.getDay()
          saturday.setDate(saturday.getDate() + daysUntilSaturday)
          handleDateSelect(saturday)
        } else {
          setTimeout(() => {
            addBotMessage(
              "Here's our live calendar! 📅 Pick any available day:",
              undefined,
              <CalendarSelector onSelect={handleDateSelect} />,
            )
          }, 500)
        }
        break

      case "final":
        // Handle post-booking interactions
        if (lowerInput.includes("book") || lowerInput.includes("appointment")) {
          // Reset everything for new booking
          resetBookingState()
          setCurrentStep("name")
          setTimeout(() => {
            addBotMessage("Great! Let's book another appointment! 🎉 What's your name?")
          }, 500)
        } else if (lowerInput.includes("update") || lowerInput.includes("modify")) {
          setTimeout(() => {
            addBotMessage(
              "To update your booking, please call us at (011) 123-4567 or visit the salon. Our team will be happy to help! 📞",
            )
          }, 500)
        } else if (lowerInput.includes("thanks") || lowerInput.includes("bye")) {
          setTimeout(() => {
            addBotMessage("You're welcome! Thanks for choosing StyleBook! See you soon! 👋✂️")
          }, 500)
        } else {
          // Default responses for final step
          setTimeout(() => {
            addBotMessage("I can help you with:", [
              "Book another appointment 📅",
              "Update my booking 📝",
              "Contact information 📞",
              "That's all, thanks! 👋",
            ])
          }, 500)
        }
        break

      default:
        // More helpful default response
        if (lowerInput.includes("book") || lowerInput.includes("appointment")) {
          resetBookingState()
          setCurrentStep("name")
          setTimeout(() => {
            addBotMessage("Perfect! Let's get you booked! What's your name? 😊")
          }, 500)
        } else if (lowerInput.includes("service") || lowerInput.includes("price")) {
          showServices()
        } else if (lowerInput.includes("help")) {
          setTimeout(() => {
            addBotMessage("I'm here to help! I can assist you with:", [
              "Book an appointment 📅",
              "View our services 💇‍♂️",
              "Contact information 📞",
              "Start over 🔄",
            ])
          }, 500)
        } else {
          setTimeout(() => {
            addBotMessage("I can help you with booking appointments! Would you like to:", [
              "Book an appointment 📅",
              "See our services 💇‍♂️",
              "Get help 💭",
            ])
          }, 500)
        }
    }
  }

  // Add this function to reset booking state
  const resetBookingState = () => {
    setBooking({
      clients: [{ name: "", phone: "", hairstyle: "", price: 0 }],
      selectedDate: null,
      selectedTime: "",
      paymentMethod: null,
      hasFriendDiscount: false,
      subtotal: 0,
      discount: 0,
      total: 0,
    })
    setCurrentClientIndex(0)
    setAvailableSlots([])
    setBookedSlots([])
  }

  const showServices = () => {
    setTimeout(() => {
      addBotMessage("Here are our amazing services! ✨", undefined, <ServicesList />)
      setTimeout(() => {
        addBotMessage("Ready to book one of these? 😍", ["Yes, let's book! 🎯", "I need more info 💭"])
      }, 1500)
    }, 500)
  }

  const handleHairstyleSelect = (style: (typeof HAIRSTYLES)[0]) => {
    setBooking((prev) => ({
      ...prev,
      clients: prev.clients.map((client, index) =>
        index === currentClientIndex ? { ...client, hairstyle: style.name, price: style.price } : client,
      ),
    }))
    addUserMessage(`${style.emoji} ${style.name} - R${style.price}`)

    setTimeout(() => {
      addBotMessage(`Excellent choice! ${style.emoji} The ${style.name} is one of our most popular services!`)
    }, 500)

    setTimeout(() => {
      addBotMessage("Would you like to bring a friend? You'll both get 10% off! 🎉", [
        "Yes, I'll bring a friend! 👥",
        "No, just me today 👤",
      ])
      setCurrentStep("friend_offer")
    }, 1500)
  }

  const handleFriendHairstyleSelect = (style: (typeof HAIRSTYLES)[0]) => {
    setBooking((prev) => {
      const updatedClients = prev.clients.map((client, index) =>
        index === currentClientIndex ? { ...client, hairstyle: style.name, price: style.price } : client,
      )
      const totals = calculateTotals(updatedClients, true)
      return {
        ...prev,
        clients: updatedClients,
        ...totals,
      }
    })

    addUserMessage(`${style.emoji} ${style.name} - R${style.price}`)

    setTimeout(() => {
      addBotMessage("Perfect! Let me show you the pricing breakdown:", undefined, <PricingBreakdown />)
    }, 500)

    setTimeout(() => {
      addBotMessage("Happy with this deal? 😊", ["Yes, looks great! ✅", "Let me change something 🔄"])
      setCurrentStep("confirm_friend_booking")
    }, 2000)
  }

  const handleDateSelect = async (date: Date) => {
    setBooking((prev) => ({ ...prev, selectedDate: date }))
    addUserMessage(format(date, "EEEE, MMMM d"))

    // Get real available time slots
    const slots = await getAvailableTimeSlots(date.toISOString().split("T")[0])
    setAvailableSlots(slots.available)
    setBookedSlots(slots.booked)

    setCurrentStep("time")

    setTimeout(() => {
      addBotMessage(`Perfect! ${format(date, "EEEE, MMMM d")} it is! 🗓️`)
    }, 500)

    setTimeout(() => {
      addBotMessage(
        "Here are the available time slots for that day:",
        undefined,
        <TimeSlotSelector availableSlots={slots.available} bookedSlots={slots.booked} onSelect={handleTimeSelect} />,
      )
    }, 1500)
  }

  const handleTimeSelect = (time: string) => {
    setBooking((prev) => {
      const next = { ...prev, selectedTime: time, paymentMethod: "cash" }

      // Show booking summary first
      setTimeout(() => {
        addBotMessage(
          "Perfect! Let me confirm your booking details:",
          undefined,
          <BookingSummary booking={next} selectedTime={time} />,
        )
      }, 1500)

      // Then proceed directly to booking creation
      setTimeout(() => {
        createBookingDirectly(next)
      }, 3000)

      return next
    })
    addUserMessage(`${time}`)
    setCurrentStep("confirming")

    setTimeout(() => {
      addBotMessage(`Great! ${time} is perfect! ⏰`)
    }, 500)
  }

  const createBookingDirectly = async (bookingData: BookingData) => {
    // Guard – prevent calling createBooking without date / time.
    if (!bookingData.selectedDate || !bookingData.selectedTime) {
      addBotMessage("Something went wrong with your booking details. Please try again. 🗓️⏰")
      return
    }

    setTimeout(() => addBotMessage("Creating your booking... ⚡"), 500)

    try {
      const totals = calculateTotals(bookingData.clients, bookingData.hasFriendDiscount)

      const result = await createBooking({
        clients: bookingData.clients,
        dateISO: bookingData.selectedDate.toISOString().split("T")[0],
        time: bookingData.selectedTime,
        paymentMethod: "cash",
        hasFriendDiscount: bookingData.hasFriendDiscount,
        ...totals,
      })

      // Persist order-id & totals
      setBooking((prev) => ({ ...prev, ...totals, orderId: result.orderId }))

      setTimeout(() => addBotMessage("🎉 BOOKING CONFIRMED! 🎉"), 1500)

      setTimeout(() => {
        addBotMessage(
          `Your order number is: ${result.orderId} ✅

💵 Please pay cash when you arrive at the salon.

I've sent confirmation SMS${bookingData.clients.length > 1 ? "es" : ""} with all the details! 📱

You'll get a reminder 5 minutes before your appointment! ⏰`,
          undefined,
          <BookingConfirmation booking={{ ...bookingData, ...totals, orderId: result.orderId }} />,
        )
      }, 2500)

      setTimeout(() => {
        const arrivalTime = calculateArrivalTime(bookingData.selectedTime)
        addBotMessage(
          `📋 **ORDER SUMMARY**

⏰ **IMPORTANT:** Please arrive 30 minutes early at ${arrivalTime}`,
          undefined,
          <OrderSummary booking={{ ...bookingData, ...totals, orderId: result.orderId }} arrivalTime={arrivalTime} />,
        )
      }, 3500)

      setTimeout(async () => {
        try {
          await sendDailyReport(bookingData.selectedDate.toISOString().split("T")[0])
          addBotMessage("📊 Daily report sent to salon management! 📈")
        } catch (err) {
          console.error("Daily-report error:", err)
        }
      }, 4500)

      setTimeout(() => {
        addBotMessage("Anything else I can help with? 😊", [
          "Book another appointment 📅",
          "Update my booking 📝",
          "That's all, thanks! 👋",
        ])
        setCurrentStep("final") // Add this line
      }, 5500)
    } catch (err) {
      console.error("Booking error:", err)
      addBotMessage("Oops! Something went wrong while creating your booking 😅. Please try again.")
    }
  }

  const BookingConfirmation = ({
    booking,
  }: {
    booking: BookingData & { orderId: string }
  }) => {
    // Fix for date error - safely handle date formatting
    const dateLabel = booking.selectedDate ? format(booking.selectedDate, "EEEE, MMMM d") : "Date TBD"

    const generateQRCode = () => {
      const qrData = `loyalty:${booking.clients[0].phone}:${Date.now()}`
      return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`
    }

    return (
      <Card className="p-4 mt-2 bg-gradient-to-r from-green-50 to-blue-50">
        <div className="text-center space-y-3">
          <div className="text-2xl">🎉</div>
          <div className="font-semibold">Booking Confirmed!</div>

          <div className="text-sm space-y-1 text-left bg-white p-3 rounded">
            <div>
              <strong>Order #:</strong> {booking.orderId}
            </div>
            {booking.clients.map((client, index) => (
              <div key={index}>
                <strong>{index === 0 ? "Primary" : "Friend"}:</strong> {client.name} - {client.hairstyle}
              </div>
            ))}
            <div>
              <strong>Date:</strong> {dateLabel}
            </div>
            <div>
              <strong>Time:</strong> {booking.selectedTime}
            </div>
            {booking.hasFriendDiscount && (
              <div className="text-green-600">
                <strong>Friend Discount:</strong> -10%
              </div>
            )}
            <div>
              <strong>Total:</strong> R{booking.total.toFixed(2)}
            </div>
            <div className="bg-yellow-50 p-2 rounded mt-2">
              <strong>💵 Payment:</strong> Pay cash when you arrive at the salon
            </div>
          </div>

          <div className="text-center">
            <QrCode className="mx-auto h-6 w-6 mb-2" />
            <div className="text-sm font-semibold">Your Loyalty QR Code</div>
            <img
              src={generateQRCode() || "/placeholder.svg"}
              alt="Loyalty QR Code"
              className="mx-auto mt-2 w-24 h-24"
            />
            <div className="text-xs text-gray-600 mt-1">Show this at the salon for loyalty points!</div>
          </div>
        </div>
      </Card>
    )
  }

  // Component definitions
  const HairstyleSelector = ({ onSelect }: { onSelect: (style: (typeof HAIRSTYLES)[0]) => void }) => (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {HAIRSTYLES.map((style) => (
        <Button
          key={style.name}
          variant="outline"
          className="h-auto p-3 text-left bg-white hover:bg-blue-50"
          onClick={() => onSelect(style)}
        >
          <div>
            <div className="font-semibold">
              {style.emoji} {style.name}
            </div>
            <div className="text-sm text-gray-600">R{style.price}</div>
          </div>
        </Button>
      ))}
    </div>
  )

  const ServicesList = () => (
    <div className="space-y-2 mt-2">
      {HAIRSTYLES.map((style) => (
        <div key={style.name} className="flex justify-between items-center p-2 bg-gray-50 rounded">
          <span>
            {style.emoji} {style.name}
          </span>
          <span className="font-semibold">R{style.price}</span>
        </div>
      ))}
    </div>
  )

  const CalendarSelector = ({ onSelect }: { onSelect: (date: Date) => void }) => (
    <div className="mt-2">
      <Calendar
        mode="single"
        selected={booking.selectedDate || undefined}
        onSelect={(date) => date && onSelect(date)}
        disabled={(date) => date < new Date() || date.getDay() === 0}
        className="rounded-md border bg-white"
      />
    </div>
  )

  const TimeSlotSelector = ({
    availableSlots,
    bookedSlots,
    onSelect,
  }: {
    availableSlots: string[]
    bookedSlots: string[]
    onSelect: (time: string) => void
  }) => (
    <div className="space-y-3 mt-2">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
          <span>Booked</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[...availableSlots, ...bookedSlots].sort().map((time) => {
          const isBooked = bookedSlots.includes(time)
          return (
            <Button
              key={time}
              variant="outline"
              disabled={isBooked}
              onClick={() => onSelect(time)}
              className={`relative ${
                isBooked
                  ? "bg-red-50 border-red-200 text-red-400 cursor-not-allowed"
                  : "bg-green-50 border-green-200 hover:bg-green-100"
              }`}
            >
              {time}
              {isBooked && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 text-xs">
                  Booked
                </Badge>
              )}
            </Button>
          )
        })}
      </div>
    </div>
  )

  const PricingBreakdown = () => {
    const totals = calculateTotals(booking.clients, booking.hasFriendDiscount)
    return (
      <Card className="p-4 mt-2 bg-gradient-to-r from-green-50 to-blue-50">
        <div className="space-y-2">
          <div className="font-semibold flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Friend Discount Pricing
          </div>
          {booking.clients.map((client, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>
                {client.name}: {client.hairstyle}
              </span>
              <span>R{client.price}</span>
            </div>
          ))}
          <hr />
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>R{totals.subtotal}</span>
          </div>
          <div className="flex justify-between text-sm text-green-600">
            <span>Friend Discount (10%):</span>
            <span>-R{totals.discount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Total:</span>
            <span>R{totals.total.toFixed(2)}</span>
          </div>
        </div>
      </Card>
    )
  }

  const BookingSummary = ({
    booking,
    selectedTime,
  }: {
    booking: BookingData
    selectedTime: string
  }) => {
    const totals = calculateTotals(booking.clients, booking.hasFriendDiscount)

    // Safely build the date string - fix for date error
    const dateLabel = booking.selectedDate ? format(booking.selectedDate, "EEEE, MMMM d") : "Date TBD"

    return (
      <Card className="p-4 mt-2 bg-blue-50">
        <div className="space-y-2">
          <div className="font-semibold">Booking Summary</div>
          {booking.clients.map((client, index) => (
            <div key={index} className="text-sm">
              <div className="font-medium">{client.name}</div>
              <div className="text-gray-600">
                {client.hairstyle} - R{client.price}
              </div>
            </div>
          ))}
          <hr />
          <div className="text-sm">
            <div>
              <strong>Date:</strong> {dateLabel}
            </div>
            <div>
              <strong>Time:</strong> {selectedTime || "Time TBD"}
            </div>
            {booking.hasFriendDiscount && (
              <div className="text-green-600">
                <strong>Friend Discount:</strong> -10%
              </div>
            )}
            <div>
              <strong>Total:</strong> R{totals.total.toFixed(2)}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const OrderSummary = ({
    booking,
    arrivalTime,
  }: { booking: BookingData & { orderId: string }; arrivalTime: string }) => {
    const dateLabel = booking.selectedDate ? format(booking.selectedDate, "EEEE, MMMM d") : "Date TBD"

    return (
      <Card className="p-4 mt-2 bg-gradient-to-r from-yellow-50 to-orange-50 border-orange-200">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-orange-800">
            <Clock className="h-5 w-5" />
            Arrival Instructions
          </div>

          <div className="bg-white p-3 rounded-lg space-y-2">
            <div className="text-sm">
              <div className="font-semibold text-orange-700">📍 Please arrive at: {arrivalTime}</div>
              <div className="text-gray-600">Your appointment: {booking.selectedTime}</div>
              <div className="text-gray-600">Date: {dateLabel}</div>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              💡 Arriving 30 minutes early allows us to: • Prepare your station • Review your preferences • Ensure the
              best experience
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm font-medium">Order #{booking.orderId}</div>
            <div className="text-xs text-gray-600">Total: R{booking.total.toFixed(2)}</div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <Scissors className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">StyleBook</h1>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Maya is online
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="max-w-2xl mx-auto p-4 pb-24">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-2 max-w-[80%] ${message.type === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`w-8 h-8 rounded-full ${
                    message.type === "user" ? "bg-blue-600" : "bg-gray-200"
                  } flex items-center justify-center flex-shrink-0`}
                >
                  {message.type === "user" ? (
                    <User className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-gray-600" />
                  )}
                </div>

                <div className={`space-y-2 ${message.type === "user" ? "items-end" : "items-start"} flex flex-col`}>
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      message.type === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-white shadow-sm rounded-bl-sm"
                    }`}
                  >
                    <div className="whitespace-pre-line">{message.content}</div>
                  </div>

                  {message.component && <div className="w-full">{message.component}</div>}

                  {message.quickReplies && (
                    <div className="flex flex-wrap gap-2">
                      {message.quickReplies.map((reply, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickReply(reply)}
                          className="bg-white hover:bg-blue-50 text-sm"
                        >
                          {reply}
                        </Button>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-2 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-gray-600" />
                </div>
                <div className="bg-white shadow-sm rounded-2xl rounded-bl-sm px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!inputValue.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
