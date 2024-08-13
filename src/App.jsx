import { useState } from "react";
import axios from "axios";
// import { useEffect } from "react";
import { Header } from "./components/Header";
import { ItemList } from "./components/ItemList";
import { SearchInput } from "./components/SearchInput";

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState([]);

  // useEffect(() => {
  //   getItems();
  // }, []);

  // const handleKeyDown = (e) => {
  //   if (e.key === "Enter" && !e.isComposing) {
  //     getItems();
  //   }
  // };

  const handleInputChange = (e) => {
    setKeyword(e.target.value);
  };

  const getItems = async () => {
    setIsLoading(true);

    const result = await axios.get(
      "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?",
      {
        params: {
          applicationId: process.env.REACT_APP_RAKUTEN_APPLICATION_ID,
          keyword: keyword,
        },
      }
    );
    const items = result.data.Items.map((item) => {
      return item.Item;
    });
    console.log(items);
    setItems(items);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <main className="flex-1 p-8 mb-20">
        <header className="flex justify-between items-center mb-10">
          <Header />
        </header>
        <SearchInput
          onInputChange={handleInputChange}
          onSubmit={getItems}
          keyword={keyword}
          // onKeyDown={handleKeyDown}
        />
        <section>
          {isLoading ? (
            <div className="flex justify-center items-center">
              <p>Loading...</p>
            </div>
          ) : (
            <ItemList items={items} />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
