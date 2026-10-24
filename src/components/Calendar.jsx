import { useState } from "react";
import "./../styles/calendar.css";

export default function CustomCalendar({ onConfirm }) {
  const [selectedDate, setSelectedDate] = useState("");

  return (
    <div className="calendarWrapper">
      <div className="calendarCard">
        <h4 className="calendarTitle">Select Date</h4>

        <input
          type="date"
          className="calendarInput"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />

        <button
          className="calendarConfirmBtn"
          disabled={!selectedDate}
          onClick={() => onConfirm(selectedDate)}
        >
          Confirm Date
        </button>
      </div>
    </div>
  );
}
