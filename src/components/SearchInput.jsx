import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function SearchInput(props) {
  return (
    <section className="mb-10">
      <input
        onChange={props.onInputChange}
        // onKeyDown={props.onKeyDown}
        className="bg-gray-700 w-1/3 p-2 rounded-l-lg focus:outline-none"
        placeholder="検索"
      />
      <button
        onClick={props.onSubmit}
        disabled={!props.keyword}
        className={`text-white font-bold py-2 px-4 rounded-r-lg ${
          props.keyword
            ? "bg-blue-500 hover:bg-blue-700"
            : "bg-gray-500 cursor-not-allowed"
        }`}
      >
        <FontAwesomeIcon icon={faSearch} />
      </button>
    </section>
  );
}
